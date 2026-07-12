import type { BrowserWindow } from "electron";
import type { AppSettings, ChatMessage, StreamChunk } from "../../src/types";
import { toAiSettings } from "../../src/lib/model-presets";
import {
  getUserAiProviderConfig,
  isPresetCredentialReady,
  isUserAiProviderId,
} from "../../src/lib/providers";
import { createOpenAiClient, formatProviderError } from "./ai";
import { runAnthropicAgentToolLoop } from "./agent-anthropic";
import { runAgentToolLoop, type AgentToolEvent } from "./agent-tools";
import type { OpenAiMessage } from "./agent-tools";
import { AgentLoopError, AgentStepBudgetError } from "./agent-reliability";
import {
  AGENT_SHELL_RULES,
  AGENT_WORKSPACE_RULES,
} from "./agent-workspace";

const AGENT_SYSTEM_APPEND = `

Ты агент VoidScribe Code — как в Cursor: помогаешь с кодом в открытой папке проекта.

Поведение:
- Понимай последнее сообщение в контексте всей переписки.
- Есть конкретная задача (создать, исправить, продолжить, «давай», «ок») — действуй через инструменты.
- Приветствие или болтовня без задачи — короткий ответ текстом, без инструментов.
- Код и файлы — через write_file, не вставляй полные файлы в чат.
- Продолжение: если ты обещал доделать и пользователь согласился — делай дальше инструментами, не пересказывай уже сделанное.
- Неясен запрос — один уточняющий вопрос, без самодеятельности.
- Стек и команды выбирает пользователь; ты знаешь экосистемы и подбираешь нужные команды.

Инструменты: list_directory, read_file, write_file, run_command, capture_page_preview, list_file_history, read_file_history, restore_file.
${AGENT_WORKSPACE_RULES}
${AGENT_SHELL_RULES}

Ошибки run_command: разбирай stdout/stderr, чини через read_file/write_file, повторяй при необходимости.
Контекст [Контекст — файл/папка: …] в сообщении — сначала read_file / list_directory по этим путям.`;

function buildAgentMessages(
  settings: ReturnType<typeof toAiSettings>,
  history: ChatMessage[]
): OpenAiMessage[] {
  const workspace = settings.workspacePath.trim();
  const system = `${settings.systemPrompt.trim()}${AGENT_SYSTEM_APPEND}

Рабочая папка: ${workspace}
Все пути — относительно этой папки.`;

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

export async function streamAgentChat(input: {
  settings: AppSettings;
  history: ChatMessage[];
  requestId: string;
  window: BrowserWindow;
  signal?: AbortSignal;
}): Promise<void> {
  const { settings, history, requestId, window, signal } = input;
  const ai = toAiSettings(settings);

  const send = (chunk: Partial<StreamChunk>) => {
    window.webContents.send("chat:stream", {
      requestId,
      delta: "",
      ...chunk,
    });
  };

  if (!isPresetCredentialReady(ai)) {
    send({ error: "Добавьте API-ключ в настройках.", done: true });
    return;
  }

  if (!ai.workspacePath.trim()) {
    send({
      error: "Выберите папку проекта слева, чтобы агент мог работать с файлами.",
      done: true,
    });
    return;
  }

  const config = getUserAiProviderConfig(ai.provider);
  const onEvent = (event: AgentToolEvent) => {
    send({ activity: event });
  };

  try {
    const messages = buildAgentMessages(ai, history);

    if (config.kind === "anthropic") {
      await runAnthropicAgentToolLoop({
        settings: ai,
        messages,
        workspaceRoot: ai.workspacePath,
        signal,
        onTextDelta: (delta) => send({ delta }),
        onEvent,
      });
    } else {
      const client = createOpenAiClient(ai);
      await runAgentToolLoop({
        client,
        model: ai.model,
        provider: ai.provider,
        messages,
        workspaceRoot: ai.workspacePath,
        maxOutputTokens: ai.maxOutputTokens,
        signal,
        onTextDelta: (delta) => send({ delta }),
        onEvent,
      });
    }

    if (signal?.aborted) {
      send({ done: true, cancelled: true });
      return;
    }

    send({ done: true });
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      send({ done: true, cancelled: true });
      return;
    }

    const raw =
      err instanceof Error ? err.message : "Не удалось выполнить задачу.";
    const message =
      err instanceof AgentLoopError || err instanceof AgentStepBudgetError
        ? raw
        : isUserAiProviderId(ai.provider)
          ? formatProviderError(ai.provider, raw)
          : raw;
    send({ error: message, done: true });
  }
}
