import type {
  AgentToolCallRecord,
  AgentToolResultRecord,
  AgentTranscriptTurn,
} from "../../src/lib/agent-transcript";
import type { OpenAiMessage } from "./agent-tools";

const MAX_TRANSCRIPT_TURNS = 16;
const MAX_TOOL_RESULT_CHARS = 1_200;
const MAX_WRITE_ARG_CHARS = 400;
const MAX_REPLACE_ARG_CHARS = 200;
const MAX_INFLIGHT_TOOL_MESSAGES = 14;

function truncateText(text: string, limit: number, note: string): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n… ${note}`;
}

function compactToolCallArguments(
  name: string,
  argsJson: string
): string {
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>;
    if (name === "write_file" && typeof args.content === "string") {
      if (args.content.length > MAX_WRITE_ARG_CHARS) {
        args.content = `${args.content.slice(0, MAX_WRITE_ARG_CHARS)}\n… (content сокращён в истории)`;
      }
      return JSON.stringify(args);
    }
    if (name === "search_replace") {
      for (const key of ["old_string", "new_string", "oldString", "newString"]) {
        const value = args[key];
        if (typeof value === "string" && value.length > MAX_REPLACE_ARG_CHARS) {
          args[key] = `${value.slice(0, MAX_REPLACE_ARG_CHARS)}…`;
        }
      }
      return JSON.stringify(args);
    }
  } catch {
    /* keep original */
  }
  return argsJson;
}

function compactToolResultText(name: string, text: string): string {
  if (name === "read_file" || name === "read_file_history") {
    return truncateText(
      text,
      MAX_TOOL_RESULT_CHARS,
      `(${text.length} симв. — вызови read_file снова при нужде)`
    );
  }
  if (name === "run_command" && text.length > 2_500) {
    return truncateText(
      text,
      2_500,
      "(вывод команды сокращён в истории)"
    );
  }
  if (text.length > 2_000) {
    return truncateText(text, 2_000, "(сокращено в истории чата)");
  }
  return text;
}

function compactToolCall(call: AgentToolCallRecord): AgentToolCallRecord {
  return {
    ...call,
    arguments: compactToolCallArguments(call.name, call.arguments),
  };
}

function compactToolResult(result: AgentToolResultRecord): AgentToolResultRecord {
  return {
    ...result,
    text: compactToolResultText(result.name, result.text),
  };
}

export function compactTranscriptTurnForApi(
  turn: AgentTranscriptTurn
): AgentTranscriptTurn {
  const toolCalls = turn.toolCalls?.map(compactToolCall);
  const toolResults = turn.toolResults?.map(compactToolResult);
  return {
    text: turn.text,
    toolCalls,
    toolResults,
  };
}

/** Сжимает transcript перед сохранением в чат и перед replay в API. */
export function compactAgentTranscriptForApi(
  turns: AgentTranscriptTurn[]
): AgentTranscriptTurn[] {
  if (turns.length === 0) return turns;

  let slice = turns;
  let dropped = 0;
  if (turns.length > MAX_TRANSCRIPT_TURNS) {
    dropped = turns.length - MAX_TRANSCRIPT_TURNS;
    slice = turns.slice(-MAX_TRANSCRIPT_TURNS);
  }

  const compacted = slice.map(compactTranscriptTurnForApi);
  if (dropped > 0 && compacted.length > 0) {
    const first = compacted[0]!;
    const prefix = `[Скрыто ${dropped} ранних шагов агента — не крути read→patch на одном файле.]`;
    compacted[0] = {
      ...first,
      text: first.text?.trim()
        ? `${prefix}\n\n${first.text}`
        : prefix,
    };
  }

  return compacted;
}

/** Урезает старые tool-сообщения в живом цикле агента (до следующего вызова API). */
export function compactInflightAgentMessages(messages: OpenAiMessage[]): void {
  const toolIndexes: number[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]?.role === "tool") {
      toolIndexes.push(index);
    }
  }

  const excess = toolIndexes.length - MAX_INFLIGHT_TOOL_MESSAGES;
  if (excess <= 0) return;

  const trimIndexes = new Set(toolIndexes.slice(0, excess));
  for (const index of trimIndexes) {
    const message = messages[index];
    if (!message || message.role !== "tool") continue;
    const content =
      typeof message.content === "string" ? message.content : "";
    if (content.length <= 280) continue;
    message.content = truncateText(
      content,
      280,
      "(старый шаг сокращён — read_file снова при нужде)"
    );
  }
}
