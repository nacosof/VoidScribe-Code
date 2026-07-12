import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";

export type ParsedInlineToolCall = {
  id: string;
  name: string;
  argumentsJson: string;
};

type LegacyFunctionCall = {
  name?: string;
  arguments?: string;
};

type ToolParseMessage = {
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: ChatCompletionMessageToolCall[];
  function_call?: LegacyFunctionCall | null;
};

const FUNCTION_TAG_RE =
  /<function=([a-zA-Z0-9_]+)>\s*([\s\S]*?)\s*<\/function>/gi;
const THINK_BLOCK_RE = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;

const KNOWN_TOOL_NAMES = [
  "list_directory",
  "read_file",
  "write_file",
  "run_command",
  "capture_page_preview",
  "list_file_history",
  "read_file_history",
  "restore_file",
] as const;

function newInlineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `inline-${crypto.randomUUID()}`;
  }
  return `inline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function findBalancedBraceEnd(text: string, openIndex: number): number | null {
  if (text[openIndex] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
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
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return null;
}

function normalizeToolArgs(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { raw: value };
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toParsedCall(
  name: string,
  args: Record<string, unknown>
): ParsedInlineToolCall {
  return {
    id: newInlineId(),
    name,
    argumentsJson: JSON.stringify(args),
  };
}

function parseToolCallPayload(
  raw: string
): { name: string; args: Record<string, unknown> } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const payload = JSON.parse(trimmed) as Record<string, unknown>;
    const name =
      typeof payload.name === "string"
        ? payload.name.trim()
        : typeof payload.function === "string"
          ? payload.function.trim()
          : typeof payload.tool === "string"
            ? payload.tool.trim()
            : "";
    if (!name) return null;

    const args = normalizeToolArgs(
      payload.arguments ??
        payload.parameters ??
        payload.args ??
        payload.input ??
        payload.params
    );
    return { name, args };
  } catch {
    return null;
  }
}

function isKnownToolName(name: string): boolean {
  return KNOWN_TOOL_NAMES.includes(name as (typeof KNOWN_TOOL_NAMES)[number]);
}

type TextSpan = { start: number; end: number; body: string };

function findToolCallTaggedSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const tagRe = /<tool_call>\s*/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(text)) !== null) {
    let cursor = match.index + match[0].length;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
    if (text[cursor] !== "{") continue;

    const endBrace = findBalancedBraceEnd(text, cursor);
    if (endBrace === null) {
      spans.push({ start: match.index, end: text.length, body: text.slice(cursor) });
      continue;
    }

    let end = endBrace + 1;
    const closeMatch = text.slice(end).match(/^\s*<\/tool_call>/i);
    if (closeMatch) end += closeMatch[0].length;

    spans.push({
      start: match.index,
      end,
      body: text.slice(cursor, endBrace + 1),
    });
  }

  return spans;
}

function findBareToolJsonSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];

  for (const toolName of KNOWN_TOOL_NAMES) {
    const marker = `"name"`;
    const value = `"${toolName}"`;
    let searchFrom = 0;

    while (searchFrom < text.length) {
      const nameIdx = text.indexOf(value, searchFrom);
      if (nameIdx === -1) break;

      const markerIdx = text.lastIndexOf(marker, nameIdx);
      if (markerIdx === -1 || nameIdx - markerIdx > 24) {
        searchFrom = nameIdx + value.length;
        continue;
      }

      let openBrace = markerIdx;
      while (openBrace > 0 && text[openBrace] !== "{") openBrace -= 1;
      if (text[openBrace] !== "{") {
        searchFrom = nameIdx + value.length;
        continue;
      }

      const endBrace = findBalancedBraceEnd(text, openBrace);
      if (endBrace === null) {
        searchFrom = nameIdx + value.length;
        continue;
      }

      const body = text.slice(openBrace, endBrace + 1);
      const parsed = parseToolCallPayload(body);
      if (parsed?.name === toolName) {
        spans.push({ start: openBrace, end: endBrace + 1, body });
      }

      searchFrom = endBrace + 1;
    }
  }

  return spans;
}

function mergeSpans(spans: TextSpan[]): TextSpan[] {
  return spans
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((span, index, list) => {
      if (index === 0) return true;
      const prev = list[index - 1];
      return span.start >= prev.end;
    });
}

function removeSpans(text: string, spans: TextSpan[]): string {
  if (spans.length === 0) return text;
  let result = "";
  let cursor = 0;
  for (const span of spans) {
    result += text.slice(cursor, span.start);
    cursor = span.end;
  }
  result += text.slice(cursor);
  return result;
}

function collectPayloadCalls(
  text: string,
  calls: ParsedInlineToolCall[],
  seen: Set<string>
): string {
  let cleaned = text;

  const consume = (
    parsed: { name: string; args: Record<string, unknown> }
  ): boolean => {
    const key = `${parsed.name}\0${JSON.stringify(parsed.args)}`;
    if (seen.has(key)) return true;
    seen.add(key);
    calls.push(toParsedCall(parsed.name, parsed.args));
    return true;
  };

  const taggedSpans = findToolCallTaggedSpans(cleaned);
  for (const span of [...taggedSpans].reverse()) {
    const parsed = parseToolCallPayload(span.body);
    if (parsed) consume(parsed);
  }
  cleaned = removeSpans(cleaned, mergeSpans(taggedSpans));

  cleaned = cleaned.replace(FUNCTION_TAG_RE, (match, name: string, body: string) => {
    const parsedBody = parseToolCallPayload(body);
    const args =
      parsedBody?.args ??
      normalizeToolArgs(
        body.trim().startsWith("{") ? body : `{"raw":${JSON.stringify(body)}}`
      );
    if (consume({ name: name.trim(), args })) return "";
    return match;
  });

  const fenceRe = /```(?:json)?\s*/gi;
  let fenceMatch: RegExpExecArray | null;
  const fenceSpans: TextSpan[] = [];
  while ((fenceMatch = fenceRe.exec(cleaned)) !== null) {
    let cursor = fenceMatch.index + fenceMatch[0].length;
    while (cursor < cleaned.length && /\s/.test(cleaned[cursor])) cursor += 1;
    if (cleaned[cursor] !== "{") continue;
    const endBrace = findBalancedBraceEnd(cleaned, cursor);
    if (endBrace === null) continue;
    let end = endBrace + 1;
    const closing = cleaned.slice(end).match(/^\s*```/);
    if (!closing) continue;
    end += closing[0].length;
    fenceSpans.push({ start: fenceMatch.index, end, body: cleaned.slice(cursor, endBrace + 1) });
  }

  for (const span of [...mergeSpans(fenceSpans)].reverse()) {
    const parsed = parseToolCallPayload(span.body);
    if (parsed && isKnownToolName(parsed.name)) consume(parsed);
  }
  cleaned = removeSpans(cleaned, mergeSpans(fenceSpans));

  const bareSpans = findBareToolJsonSpans(cleaned);
  for (const span of [...bareSpans].reverse()) {
    const parsed = parseToolCallPayload(span.body);
    if (parsed) consume(parsed);
  }
  cleaned = removeSpans(cleaned, mergeSpans(bareSpans));

  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

export function parseInlineToolCalls(text: string): {
  cleanedText: string;
  calls: ParsedInlineToolCall[];
} {
  const calls: ParsedInlineToolCall[] = [];
  const seen = new Set<string>();
  const cleanedText = collectPayloadCalls(text, calls, seen);
  return { cleanedText, calls };
}

export function sanitizeAssistantDisplayText(text: string): string {
  return parseInlineToolCalls(text).cleanedText;
}

export function partitionAssistantDisplayText(text: string): {
  body: string;
  thoughts: string[];
} {
  const thoughts: string[] = [];
  const withoutThinking = text.replace(THINK_BLOCK_RE, (_, thought: string) => {
    const trimmed = String(thought).trim();
    if (trimmed) thoughts.push(trimmed);
    return "";
  });

  return {
    body: sanitizeAssistantDisplayText(withoutThinking),
    thoughts,
  };
}

function stripInlineToolMarkup(text: string): string {
  return sanitizeAssistantDisplayText(text);
}

function legacyFunctionToToolCall(
  call: LegacyFunctionCall | null | undefined
): ChatCompletionMessageToolCall[] {
  if (!call?.name?.trim()) return [];
  return [
    {
      id: `legacy-${newInlineId()}`,
      type: "function",
      function: {
        name: call.name.trim(),
        arguments:
          typeof call.arguments === "string" ? call.arguments : "{}",
      },
    },
  ];
}

export function resolveAssistantToolCalls(message: ToolParseMessage): {
  toolCalls: ChatCompletionMessageToolCall[];
  visibleText: string;
} {
  const apiToolCalls = message.tool_calls ?? [];
  if (apiToolCalls.length > 0) {
    const visible =
      typeof message.content === "string"
        ? stripInlineToolMarkup(message.content)
        : "";
    return { toolCalls: apiToolCalls, visibleText: visible };
  }

  const legacy = legacyFunctionToToolCall(message.function_call);
  if (legacy.length > 0) {
    const visible =
      typeof message.content === "string"
        ? stripInlineToolMarkup(message.content)
        : "";
    return { toolCalls: legacy, visibleText: visible };
  }

  const content =
    typeof message.content === "string" ? message.content : "";
  const reasoning =
    typeof message.reasoning_content === "string"
      ? message.reasoning_content
      : "";
  const combined = [content, reasoning].filter(Boolean).join("\n");
  const inline = parseInlineToolCalls(combined);

  const visibleText = partitionAssistantDisplayText(content).body.trim();

  if (inline.calls.length === 0) {
    return { toolCalls: [], visibleText: visibleText || content.trim() };
  }

  return {
    visibleText,
    toolCalls: inline.calls.map((call) => ({
      id: call.id,
      type: "function" as const,
      function: {
        name: call.name,
        arguments: call.argumentsJson,
      },
    })),
  };
}
