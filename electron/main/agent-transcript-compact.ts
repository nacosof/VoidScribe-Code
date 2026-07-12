import type { AgentToolCallRecord, AgentToolResultRecord, AgentTranscriptTurn, } from "../../src/lib/agent-transcript";
import type { UserAiProviderId } from "../../src/lib/providers";
import type { OpenAiMessage } from "./agent-tools";
const MAX_TRANSCRIPT_TURNS = 16;
const MAX_TRANSCRIPT_TURNS_MISTRAL = 3;
const MAX_TOOL_RESULT_CHARS = 1200;
const MAX_TOOL_RESULT_CHARS_MISTRAL = 350;
const MAX_WRITE_ARG_CHARS = 400;
const MAX_REPLACE_ARG_CHARS = 200;
const MAX_INFLIGHT_TOOL_MESSAGES = 10;
const MAX_INFLIGHT_TOOL_MESSAGES_MISTRAL = 6;
function truncateText(text: string, limit: number, note: string): string {
    if (text.length <= limit)
        return text;
    return `${text.slice(0, limit)}\n\n… ${note}`;
}
function compactToolCallArguments(name: string, argsJson: string): string {
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
    }
    catch {
    }
    return argsJson;
}
function compactToolResultText(name: string, text: string, maxToolChars = MAX_TOOL_RESULT_CHARS): string {
    if (name === "read_file" || name === "read_file_history") {
        return truncateText(text, maxToolChars, `(${text.length} симв. — вызови read_file снова при нужде)`);
    }
    if (name === "run_command" && text.length > maxToolChars + 300) {
        return truncateText(text, Math.min(1200, maxToolChars + 300), "(вывод команды сокращён в истории)");
    }
    if (text.length > Math.max(2000, maxToolChars + 800)) {
        return truncateText(text, 2000, "(сокращено в истории чата)");
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
export function compactTranscriptTurnForApi(turn: AgentTranscriptTurn): AgentTranscriptTurn {
    const toolCalls = turn.toolCalls?.map(compactToolCall);
    const toolResults = turn.toolResults?.map(compactToolResult);
    return {
        text: turn.text,
        toolCalls,
        toolResults,
    };
}
export function compactAgentTranscriptForApi(turns: AgentTranscriptTurn[], options?: {
    provider?: UserAiProviderId;
}): AgentTranscriptTurn[] {
    if (turns.length === 0)
        return turns;
    const mistral = options?.provider === "mistral";
    const maxTurns = mistral ? MAX_TRANSCRIPT_TURNS_MISTRAL : MAX_TRANSCRIPT_TURNS;
    const maxToolChars = mistral
        ? MAX_TOOL_RESULT_CHARS_MISTRAL
        : MAX_TOOL_RESULT_CHARS;
    let slice = turns;
    let dropped = 0;
    if (turns.length > maxTurns) {
        dropped = turns.length - maxTurns;
        slice = turns.slice(-maxTurns);
    }
    const compacted = slice.map((turn) => {
        const toolCalls = turn.toolCalls?.map(compactToolCall);
        const toolResults = turn.toolResults?.map((result) => ({
            ...result,
            text: compactToolResultText(result.name, result.text, maxToolChars),
        }));
        return {
            text: turn.text,
            toolCalls,
            toolResults,
        };
    });
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
export function compactInflightAgentMessages(messages: OpenAiMessage[], options?: {
    provider?: UserAiProviderId;
}): void {
    const mistral = options?.provider === "mistral";
    const maxToolMessages = mistral
        ? MAX_INFLIGHT_TOOL_MESSAGES_MISTRAL
        : MAX_INFLIGHT_TOOL_MESSAGES;
    const toolIndexes: number[] = [];
    for (let index = 0; index < messages.length; index += 1) {
        if (messages[index]?.role === "tool") {
            toolIndexes.push(index);
        }
    }
    const excess = toolIndexes.length - maxToolMessages;
    if (excess <= 0)
        return;
    const trimIndexes = new Set(toolIndexes.slice(0, excess));
    for (const index of trimIndexes) {
        const message = messages[index];
        if (!message || message.role !== "tool")
            continue;
        const content = typeof message.content === "string" ? message.content : "";
        if (content.length <= 280)
            continue;
        message.content = truncateText(content, 280, "(старый шаг сокращён — read_file снова при нужде)");
    }
}
