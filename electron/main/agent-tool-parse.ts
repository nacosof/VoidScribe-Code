import type OpenAI from "openai";
type RawToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
const KNOWN_TOOL_NAMES = [
    "list_directory",
    "read_file",
    "write_file",
    "search_replace",
    "grep",
    "run_command",
    "delete_path",
    "read_lint_errors",
    "list_file_history",
    "read_file_history",
    "restore_file",
    "capture_page_preview",
] as const;
function newInlineId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
function findBalancedBraceEnd(text: string, openIndex: number): number | null {
    if (text[openIndex] !== "{")
        return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = openIndex; i < text.length; i += 1) {
        const ch = text[i]!;
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === "\\" && inString) {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString)
            continue;
        if (ch === "{")
            depth += 1;
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0)
                return i;
        }
    }
    return null;
}
function unescapeJsonString(raw: string): string {
    return raw
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
}
function salvageBrokenWriteFileJson(raw: string): Record<string, unknown> | null {
    if (!/"write_file"/.test(raw) && !/"name"\s*:\s*"write_file"/.test(raw))
        return null;
    const pathMatch = raw.match(/"path"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (!pathMatch?.[1])
        return null;
    const contentMarker = raw.match(/"content"\s*:\s*"/);
    if (!contentMarker || contentMarker.index === undefined) {
        return { path: unescapeJsonString(pathMatch[1]), content: "" };
    }
    const start = contentMarker.index + contentMarker[0].length;
    let content = "";
    for (let i = start; i < raw.length; i += 1) {
        const ch = raw[i]!;
        if (ch === "\\" && i + 1 < raw.length) {
            content += raw[i + 1];
            i += 1;
            continue;
        }
        if (ch === '"')
            break;
        content += ch;
    }
    return {
        path: unescapeJsonString(pathMatch[1]),
        content: unescapeJsonString(content),
    };
}
function normalizeToolArgs(value: unknown): Record<string, unknown> {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        }
        catch {
            const salvaged = salvageBrokenWriteFileJson(trimmed);
            if (salvaged)
                return salvaged;
            return { raw: value };
        }
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}
function parseToolCallPayload(raw: string): {
    name: string;
    args: Record<string, unknown>;
} | null {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    try {
        const payload = JSON.parse(trimmed) as Record<string, unknown>;
        const name = typeof payload.name === "string"
            ? payload.name.trim()
            : typeof payload.function === "string"
                ? payload.function.trim()
                : "";
        if (!name)
            return null;
        const args = normalizeToolArgs(payload.arguments ?? payload.parameters ?? payload.args ?? payload.input);
        return { name, args };
    }
    catch {
        const salvaged = salvageBrokenWriteFileJson(trimmed);
        if (salvaged?.path) {
            return { name: "write_file", args: salvaged };
        }
        return null;
    }
}
type TextSpan = {
    start: number;
    end: number;
    body: string;
};
function findToolCallTaggedSpans(text: string): TextSpan[] {
    const spans: TextSpan[] = [];
    const tagRe = /<tool_call>\s*/gi;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(text)) !== null) {
        let cursor = match.index + match[0].length;
        while (cursor < text.length && /\s/.test(text[cursor]!))
            cursor += 1;
        if (text[cursor] !== "{")
            continue;
        const endBrace = findBalancedBraceEnd(text, cursor);
        if (endBrace === null) {
            spans.push({ start: match.index, end: text.length, body: text.slice(cursor) });
            continue;
        }
        let end = endBrace + 1;
        const closeMatch = text.slice(end).match(/^\s*<\/tool_call>/i);
        if (closeMatch)
            end += closeMatch[0].length;
        spans.push({
            start: match.index,
            end,
            body: text.slice(cursor, endBrace + 1),
        });
    }
    return spans;
}
function removeSpans(text: string, spans: TextSpan[]): string {
    if (!spans.length)
        return text;
    let result = "";
    let cursor = 0;
    for (const span of spans) {
        result += text.slice(cursor, span.start);
        cursor = span.end;
    }
    result += text.slice(cursor);
    return result;
}
function parseInlineTools(text: string): {
    visibleText: string;
    toolCalls: RawToolCall[];
    truncatedInlineTool: boolean;
} {
    const calls: RawToolCall[] = [];
    const seen = new Set<string>();
    const taggedSpans = findToolCallTaggedSpans(text);
    for (const span of taggedSpans) {
        const parsed = parseToolCallPayload(span.body) ??
            (() => {
                const salvaged = salvageBrokenWriteFileJson(span.body);
                return salvaged ? { name: "write_file", args: salvaged } : null;
            })();
        if (!parsed?.name)
            continue;
        const key = `${parsed.name}\0${JSON.stringify(parsed.args)}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        calls.push({
            id: newInlineId(),
            type: "function",
            function: {
                name: parsed.name,
                arguments: JSON.stringify(parsed.args),
            },
        });
    }
    let visible = removeSpans(text, taggedSpans);
    const legacyRe = /<tool_call>([\s\S]*?)<\/tool_call>|\[TOOL_REQUEST\]([\s\S]*?)\[END_TOOL_REQUEST\]/gi;
    for (const match of text.matchAll(legacyRe)) {
        visible = visible.replace(match[0], "").trim();
    }
    const hasToolMarkup = /<tool_call>|\[TOOL_REQUEST\]/i.test(text) || taggedSpans.length > 0;
    return {
        visibleText: visible.replace(/\n{3,}/g, "\n\n").trim(),
        toolCalls: calls,
        truncatedInlineTool: hasToolMarkup && calls.length === 0,
    };
}
export function salvageWriteArguments(name: string, argsJson: string, assistantText: string): string {
    if (name !== "write_file" && name !== "search_replace")
        return argsJson;
    let args: Record<string, unknown>;
    try {
        args = JSON.parse(argsJson) as Record<string, unknown>;
    }
    catch {
        const salvaged = salvageBrokenWriteFileJson(argsJson);
        if (salvaged) {
            args = salvaged;
        }
        else {
            return argsJson;
        }
    }
    const nested = args.arguments;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        args = { ...(nested as Record<string, unknown>) };
    }
    const contentKeys = name === "write_file"
        ? ["content", "contents", "body", "text", "code"]
        : ["new_string", "newString", "content", "text"];
    let content = "";
    for (const key of contentKeys) {
        if (typeof args[key] === "string" && (args[key] as string).trim()) {
            content = args[key] as string;
            break;
        }
    }
    if (!content.trim() && assistantText.trim()) {
        const fence = assistantText.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (fence?.[1]?.trim())
            content = fence[1];
    }
    if (!content.trim())
        return argsJson;
    if (name === "write_file")
        args.content = content;
    else
        args.new_string = content;
    return JSON.stringify(args);
}
export function resolveAssistantToolCalls(input: {
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: RawToolCall[];
    function_call?: {
        name?: string;
        arguments?: string;
    };
}): {
    visibleText: string;
    toolCalls: RawToolCall[];
    truncatedInlineTool: boolean;
} {
    const text = [input.content, input.reasoning_content].filter(Boolean).join("\n");
    const inline = parseInlineTools(text);
    const native = input.tool_calls ?? [];
    if (native.length) {
        return { visibleText: input.content ?? "", toolCalls: native, truncatedInlineTool: false };
    }
    if (input.function_call?.name) {
        return {
            visibleText: input.content ?? "",
            toolCalls: [
                {
                    id: newInlineId(),
                    type: "function",
                    function: {
                        name: input.function_call.name,
                        arguments: input.function_call.arguments ?? "{}",
                    },
                },
            ],
            truncatedInlineTool: false,
        };
    }
    return inline;
}
export function peekTruncatedWriteFilePath(text: string): string | null {
    const match = text.match(/"path"\s*:\s*"([^"]+)"/);
    return match?.[1] ?? null;
}
export { KNOWN_TOOL_NAMES };
