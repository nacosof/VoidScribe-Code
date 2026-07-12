import {
  AGENT_TOOLS,
  executeAgentTool,
  type AgentToolEvent,
  type OpenAiMessage,
} from "./agent-tools";
import { resolveAnthropicMaxTokens, type AiRuntimeSettings } from "./ai";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUT_MS = 120_000;
const MAX_AGENT_STEPS = 12;

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type AnthropicTextBlock = { type: "text"; text: string };

type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

function getAnthropicAgentTools(): AnthropicTool[] {
  return AGENT_TOOLS.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? "",
    input_schema: (tool.function.parameters ?? {
      type: "object",
      properties: {},
    }) as Record<string, unknown>,
  }));
}

function splitAgentMessages(messages: OpenAiMessage[]): {
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

  return { system, messages: out };
}

async function callAnthropic(input: {
  apiKey: string;
  model: string;
  system: string;
  messages: AnthropicMessage[];
  maxOutputTokens?: number;
  signal?: AbortSignal;
}): Promise<{
  content: AnthropicContentBlock[];
  stop_reason: string | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  if (input.signal) {
    if (input.signal.aborted) {
      clearTimeout(timer);
      throw new DOMException("Aborted", "AbortError");
    }
    input.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey.trim(),
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: resolveAnthropicMaxTokens(input.maxOutputTokens),
        system: input.system,
        tools: getAnthropicAgentTools(),
        messages: input.messages,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      content?: AnthropicContentBlock[];
      stop_reason?: string | null;
    };

    if (!res.ok) {
      throw new Error(data.error?.message || `Anthropic ${res.status}`);
    }

    return {
      content: data.content ?? [],
      stop_reason: data.stop_reason ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runAnthropicAgentToolLoop(input: {
  settings: AiRuntimeSettings;
  messages: OpenAiMessage[];
  workspaceRoot: string;
  signal?: AbortSignal;
  onTextDelta: (delta: string) => void;
  onEvent: (event: AgentToolEvent) => void;
}): Promise<void> {
  const { settings, workspaceRoot, signal, onTextDelta, onEvent } = input;
  const { system, messages } = splitAgentMessages(input.messages);

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const response = await callAnthropic({
      apiKey: settings.apiKey,
      model: settings.model,
      system,
      messages,
      maxOutputTokens: settings.maxOutputTokens,
      signal,
    });

    const toolUses = response.content.filter(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use"
    );
    const text = response.content
      .filter((block): block is AnthropicTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (toolUses.length > 0) {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: AnthropicToolResultBlock[] = [];
      for (const toolUse of toolUses) {
        const result = await executeAgentTool({
          workspaceRoot,
          name: toolUse.name,
          argsJson: JSON.stringify(toolUse.input ?? {}),
          onEvent,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    if (text) {
      onTextDelta(text);
    }

    return;
  }

  throw new Error("Слишком много шагов агента. Уточните задачу.");
}
