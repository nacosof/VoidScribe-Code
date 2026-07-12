import { WorkspaceError, resolveAgentRelativePath } from "../workspace";

export type ToolArgs = Record<string, unknown>;

export const MAX_WRITE_FILE_LINES = 150;

export function parseToolArgs(raw: string): ToolArgs {
    try {
        return JSON.parse(raw || "{}");
    }
    catch {
        throw new WorkspaceError("Некорректный JSON аргументов инструмента.");
    }
}

export function readStringArg(args: ToolArgs, ...keys: string[]): string {
    for (const key of keys)
        if (typeof args[key] === "string")
            return args[key] as string;
    return "";
}

export function countOccurrences(haystack: string, needle: string): number {
    if (!needle)
        return 0;
    return haystack.split(needle).length - 1;
}

export function asErrorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export function clampWriteFileContent(content: string): {
    content: string;
    autoTruncated: boolean;
    originalLines: number;
} {
    const lines = content.split(/\r?\n/);
    const originalLines = lines.length;
    if (originalLines <= MAX_WRITE_FILE_LINES) {
        return { content, autoTruncated: false, originalLines };
    }
    return {
        content: lines.slice(0, MAX_WRITE_FILE_LINES).join("\n"),
        autoTruncated: true,
        originalLines,
    };
}

export function normalizeWriteContent(args: ToolArgs): string {
    if (typeof args.content === "string")
        return args.content;
    for (const key of ["contents", "body", "text", "code", "source"]) {
        const value = args[key];
        if (typeof value === "string")
            return value;
    }
    return "";
}

export function toolDetailForError(name: string, args: ToolArgs, workspaceRoot?: string): string {
    if (name === "run_command")
        return String(args.command ?? name);
    if (name === "grep")
        return String(args.pattern ?? name);
    if (name === "capture_page_preview")
        return String(args.url ?? name);
    const rawPath = String(args.path ?? args.id ?? name);
    if (workspaceRoot &&
        typeof args.path === "string" &&
        ["read_file", "write_file", "search_replace", "delete_path"].includes(name)) {
        try {
            return resolveAgentRelativePath(workspaceRoot, args.path);
        }
        catch {
            return rawPath;
        }
    }
    return rawPath;
}
