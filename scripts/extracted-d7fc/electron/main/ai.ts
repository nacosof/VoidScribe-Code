import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { BrowserWindow } from "electron";
import type { AppSettings, ChatMessage } from "../../src/types";
import {
  getUserAiProviderConfig,
  type UserAiProviderId,
} from "../../src/lib/providers";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUT_MS = 120_000;

type AnthropicMessage = { role: "user" | "assistant"; content: string };

function splitAnthropicMessages(messages: ChatCompletionMessageParam[]): {
  system: string;
  messages: AnthropicMessage[];
} {
  let system = "";
  const out: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system" && typeof msg.content === "string") {
      system = msg.content;
      continue;
    }
    if (msg.role === "user" || msg.role === "assistant") {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      out.push({ role: msg.role, content });
    }
  }

  if (out.length === 0) {
    out.push({ role: "user", content: "ping" });
  }

  return { system, messages: out };
}

function createOpenAiClient(settings: AppSettings): OpenAI {
  const config = getUserAiProviderConfig(settings.provider);
  return new OpenAI({
    apiKey: settings.apiKey.trim(),
    baseURL: config.baseURL,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
  });
}

function toCompletionMessages(
  settings: AppSettings,
  history: ChatMessage[]
): ChatCompletionMessageParam[] {
  const workspaceNote = settings.workspacePath.trim()
    ? `\n\nРабочая папка проекта: ${settings.workspacePath}`
    : "";

  const system = `${settings.systemPrompt.trim()}${workspaceNote}`;

  return [
    { role: "system", content: system },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: m.content,
      })),
  ];
}

async function streamAnthropic(
  settings: AppSettings,
  messages: ChatCompletionMessageParam[],
  onDelta: (delta: string) => void
): Promise<void> {
  const { system, messages: anthropicMessages } =
    splitAnthropicMessages(messages);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.apiKey.trim(),
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 4096,
        stream: true,
        ...(system ? { system } : {}),
        messages: anthropicMessages,
      }),
    });

    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(data.error?.message || `Anthropic ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            event.delta.text
          ) {
            onDelta(event.delta.text);
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

async function streamOpenAiCompatible(
  settings: AppSettings,
  messages: ChatCompletionMessageParam[],
  onDelta: (delta: string) => void
): Promise<void> {
  const client = createOpenAiClient(settings);
  const stream = await client.chat.completions.create({
    model: settings.model,
    messages,
    temperature: 0.4,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) onDelta(delta);
  }
}

export async function streamChatCompletion(input: {
  settings: AppSettings;
  history: ChatMessage[];
  requestId: string;
  window: BrowserWindow;
}): Promise<void> {
  const { settings, history, requestId, window } = input;

  if (!settings.apiKey.trim()) {
    window.webContents.send("chat:stream", {
      requestId,
      delta: "",
      error: "Добавьте API-ключ в настройках.",
      done: true,
    });
    return;
  }

  const messages = toCompletionMessages(settings, history);
  const config = getUserAiProviderConfig(settings.provider as UserAiProviderId);

  const send = (delta: string, extra?: { error?: string; done?: boolean }) => {
    window.webContents.send("chat:stream", {
      requestId,
      delta,
      ...extra,
    });
  };

  try {
    const onDelta = (delta: string) => send(delta);

    if (config.kind === "anthropic") {
      await streamAnthropic(settings, messages, onDelta);
    } else {
      await streamOpenAiCompatible(settings, messages, onDelta);
    }

    send("", { done: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Не удалось получить ответ.";
    send("", { error: message, done: true });
  }
}
