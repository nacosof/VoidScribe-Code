import { Fragment, useMemo } from "react";
import type { UiLanguage } from "@/types";
import { CodeBlockShell } from "@/components/CodeBlockShell";
type ContentSegment = {
    type: "text";
    value: string;
} | {
    type: "code";
    lang: string;
    value: string;
};
const FENCE_RE = /```(\w*)\r?\n?([\s\S]*?)```/g;
const COMMAND_LINE_RE = /^(curl|npm|pnpm|yarn|git|taskkill|netstat|npx|python|pip|node|powershell|pwsh|cd|mkdir|echo|sh|bash)\b/i;
function splitFencedBlocks(content: string): ContentSegment[] {
    const segments: ContentSegment[] = [];
    let lastIndex = 0;
    for (const match of content.matchAll(FENCE_RE)) {
        const index = match.index ?? 0;
        if (index > lastIndex) {
            segments.push({ type: "text", value: content.slice(lastIndex, index) });
        }
        segments.push({
            type: "code",
            lang: match[1]?.trim() || "text",
            value: match[2]?.replace(/\n$/, "") ?? "",
        });
        lastIndex = index + match[0].length;
    }
    if (lastIndex < content.length) {
        segments.push({ type: "text", value: content.slice(lastIndex) });
    }
    return segments.length ? segments : [{ type: "text", value: content }];
}
function splitStandaloneCommands(text: string): ContentSegment[] {
    const lines = text.split(/\r?\n/);
    const segments: ContentSegment[] = [];
    let prose: string[] = [];
    let command: string[] = [];
    let commandLang = "sh";
    const flushProse = () => {
        if (!prose.length)
            return;
        segments.push({ type: "text", value: prose.join("\n") });
        prose = [];
    };
    const flushCommand = () => {
        if (!command.length)
            return;
        segments.push({ type: "code", lang: commandLang, value: command.join("\n") });
        command = [];
        commandLang = "sh";
    };
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const trimmed = line.trim();
        if (!trimmed) {
            if (command.length) {
                command.push("");
            }
            else {
                prose.push("");
            }
            continue;
        }
        if (/^(sh|bash|powershell|pwsh)$/i.test(trimmed)) {
            flushProse();
            flushCommand();
            commandLang = trimmed.toLowerCase().startsWith("powershell") || trimmed.toLowerCase() === "pwsh"
                ? "powershell"
                : trimmed.toLowerCase() === "bash"
                    ? "bash"
                    : "sh";
            continue;
        }
        const looksLikeCommand = COMMAND_LINE_RE.test(trimmed) ||
            (/\|\s*\w+/.test(trimmed) && /^[\w"'./\\-]/.test(trimmed));
        if (looksLikeCommand) {
            flushProse();
            command.push(trimmed);
            continue;
        }
        if (command.length) {
            flushCommand();
        }
        prose.push(line);
    }
    flushProse();
    flushCommand();
    return segments.length ? segments : [{ type: "text", value: text }];
}
function parseMessageSegments(content: string): ContentSegment[] {
    const fenced = splitFencedBlocks(content);
    const expanded: ContentSegment[] = [];
    for (const segment of fenced) {
        if (segment.type === "code") {
            expanded.push(segment);
        }
        else {
            expanded.push(...splitStandaloneCommands(segment.value));
        }
    }
    return expanded;
}
function renderInlineText(text: string, keyPrefix: string) {
    const parts = text.split(/(`[^`\n]+`)/g);
    return parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
            return (<code key={`${keyPrefix}-code-${index}`} className="md-inline-code">
          {part.slice(1, -1)}
        </code>);
        }
        const chunks = part.split(/\n/);
        return (<Fragment key={`${keyPrefix}-text-${index}`}>
        {chunks.map((chunk, chunkIndex) => (<Fragment key={`${keyPrefix}-chunk-${index}-${chunkIndex}`}>
            {chunkIndex > 0 ? <br /> : null}
            {chunk}
          </Fragment>))}
      </Fragment>);
    });
}
function renderTextSegment(text: string, keyPrefix: string) {
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map((paragraph, index) => (<p key={`${keyPrefix}-p-${index}`} className="chat-markdown__p">
      {renderInlineText(paragraph, `${keyPrefix}-p-${index}`)}
    </p>));
}
export function MessageContent({ content, lang = "ru", error = false, }: {
    content: string;
    lang?: UiLanguage;
    error?: boolean;
}) {
    const segments = useMemo(() => parseMessageSegments(content), [content]);
    if (!content.trim())
        return null;
    const isError = error || content.startsWith("Ошибка:") || content.startsWith("Error:");
    return (<div className={isError ? "chat-markdown chat-markdown--error" : "chat-markdown"}>
      {segments.map((segment, index) => segment.type === "code" ? (<CodeBlockShell key={`code-${index}`} code={segment.value} lang={segment.lang} uiLang={lang}/>) : (<Fragment key={`text-${index}`}>{renderTextSegment(segment.value, `text-${index}`)}</Fragment>))}
    </div>);
}
