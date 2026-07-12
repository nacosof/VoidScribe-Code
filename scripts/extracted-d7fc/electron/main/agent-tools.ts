import type OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  listWorkspaceDirectory,
  readWorkspaceFile,
  writeWorkspaceFile,
  WorkspaceError,
} from "./workspace";
import { runWorkspaceCommand } from "./terminal";

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_directory",
      description:
        "Список файлов и папок в рабочей директории проекта. path — относительный путь, по умолчанию корень.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Относительный путь, например . или src",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Прочитать текстовый файл в проекте.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Относительный путь к файлу",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Создать или перезаписать текстовый файл в проекте. Создаёт папки при необходимости.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Относительный путь к файлу",
          },
          content: {
            type: "string",
            description: "Содержимое файла",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Выполнить shell-команду в корне проекта (npm, git, и т.д.). Вывод попадёт в консоль.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Команда для выполнения",
          },
        },
        required: ["command"],
      },
    },
  },
];

export type AgentToolEvent =
  | { type: "tool_start"; name: string; detail: string }
  | { type: "tool_done"; name: string; detail: string }
  | { type: "console_command"; command: string; source: "agent" | "user" }
  | { type: "console_output"; text: string; stream: "stdout" | "stderr" | "system" };

type ToolArgs = Record<string, unknown>;

function parseToolArgs(raw: string): ToolArgs {
  try {
    const parsed = JSON.parse(raw) as ToolArgs;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function executeAgentTool(input: {
  workspaceRoot: string;
  name: string;
  argsJson: string;
  onEvent: (event: AgentToolEvent) => void;
}): Promise<string> {
  const { workspaceRoot, name, argsJson, onEvent } = input;
  const args = parseToolArgs(argsJson);

  try {
    if (name === "list_directory") {
      const path = typeof args.path === "string" ? args.path : ".";
      onEvent({ type: "tool_start", name, detail: path });
      const listing = await listWorkspaceDirectory(workspaceRoot, path);
      onEvent({ type: "tool_done", name, detail: path });
      return listing;
    }

    if (name === "read_file") {
      const path = String(args.path ?? "");
      if (!path) throw new WorkspaceError("Укажите path.");
      onEvent({ type: "tool_start", name, detail: path });
      const content = await readWorkspaceFile(workspaceRoot, path);
      onEvent({ type: "tool_done", name, detail: path });
      return content;
    }

    if (name === "write_file") {
      const path = String(args.path ?? "");
      const content = typeof args.content === "string" ? args.content : "";
      if (!path) throw new WorkspaceError("Укажите path.");
      onEvent({ type: "tool_start", name, detail: path });
      await writeWorkspaceFile(workspaceRoot, path, content);
      onEvent({ type: "tool_done", name, detail: path });
      return `Файл записан: ${path} (${content.length} символов)`;
    }

    if (name === "run_command") {
      const command = String(args.command ?? "").trim();
      if (!command) throw new WorkspaceError("Укажите command.");
      onEvent({ type: "console_command", command, source: "agent" });
      const result = await runWorkspaceCommand(workspaceRoot, command);
      if (result.stdout.trim()) {
        onEvent({
          type: "console_output",
          text: result.stdout,
          stream: "stdout",
        });
      }
      if (result.stderr.trim()) {
        onEvent({
          type: "console_output",
          text: result.stderr,
          stream: "stderr",
        });
      }
      return JSON.stringify({
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    }

    throw new WorkspaceError(`Неизвестный инструмент: ${name}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Не удалось выполнить инструмент.";
    return `Ошибка: ${message}`;
  }
}

export type OpenAiMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MAX_AGENT_STEPS = 12;

export async function runAgentToolLoop(input: {
  client: OpenAI;
  model: string;
  messages: OpenAiMessage[];
  workspaceRoot: string;
  onTextDelta: (delta: string) => void;
  onEvent: (event: AgentToolEvent) => void;
}): Promise<void> {
  const { client, model, workspaceRoot, onTextDelta, onEvent } = input;
  const messages = [...input.messages];

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
    });

    const choice = response.choices[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("Пустой ответ модели.");
    }

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: message.content ?? "",
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        if (call.type !== "function") continue;

        const result = await executeAgentTool({
          workspaceRoot,
          name: call.function.name,
          argsJson: call.function.arguments,
          onEvent,
        });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      continue;
    }

    if (message.content) {
      onTextDelta(message.content);
    }

    return;
  }

  throw new Error("Слишком много шагов агента. Уточните задачу.");
}
