import type { ChatContextRef, ChatMessage } from "../../src/types";
import { buildUserMessageContent } from "../../src/lib/chat-context";
import { listWorkspaceDirectory, readWorkspaceFile } from "./workspace";
const MAX_FILE_CHARS = 24000;
const MAX_DIR_ENTRIES = 80;
async function readContextFile(workspaceRoot: string, ref: ChatContextRef): Promise<string> {
    try {
        const content = await readWorkspaceFile(workspaceRoot, ref.path);
        if (!content.trim()) {
            return "(пустой файл — один write_file с полным content в поле JSON «content», read_file не нужен)";
        }
        if (content.length <= MAX_FILE_CHARS)
            return content;
        return `${content.slice(0, MAX_FILE_CHARS)}\n\n… (файл обрезан, ${content.length} симв.)`;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `[Не удалось прочитать файл: ${message}]`;
    }
}
async function listContextDirectory(workspaceRoot: string, ref: ChatContextRef): Promise<string> {
    try {
        const entries = await listWorkspaceDirectory(workspaceRoot, ref.path);
        const lines = entries.slice(0, MAX_DIR_ENTRIES).map((entry) => {
            const suffix = entry.kind === "directory" ? "/" : "";
            return `${entry.name}${suffix}`;
        });
        if (entries.length > MAX_DIR_ENTRIES) {
            lines.push(`… и ещё ${entries.length - MAX_DIR_ENTRIES} элементов`);
        }
        return lines.join("\n") || "(пустая папка)";
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `[Не удалось прочитать папку: ${message}]`;
    }
}
export async function enrichUserMessageText(message: ChatMessage, workspaceRoot: string): Promise<string> {
    const refs = message.contextRefs ?? [];
    const base = buildUserMessageContent(message.content, refs);
    if (!refs.length || !workspaceRoot.trim())
        return base;
    const blocks: string[] = [base];
    for (const ref of refs) {
        if (ref.kind === "file") {
            const body = await readContextFile(workspaceRoot, ref);
            blocks.push(`\n\n--- ${ref.path} ---\n${body}`);
        }
        else {
            const listing = await listContextDirectory(workspaceRoot, ref);
            blocks.push(`\n\n--- ${ref.path}/ ---\n${listing}`);
        }
    }
    return blocks.join("");
}
export async function enrichChatHistory(history: ChatMessage[], workspaceRoot: string): Promise<ChatMessage[]> {
    if (!workspaceRoot.trim())
        return history;
    return Promise.all(history.map(async (message) => {
        if (message.role !== "user" || !message.contextRefs?.length)
            return message;
        const content = await enrichUserMessageText(message, workspaceRoot);
        return { ...message, content, contextRefs: undefined };
    }));
}
