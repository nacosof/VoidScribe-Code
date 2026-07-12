import type { ChatContextRef, UiLanguage } from "@/types";
export const CHAT_ENTRY_DRAG_MIME = "application/voidscribe-entry";
function normalizePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
function userWantsFileChange(text: string): boolean {
    return /(?:передел|измен|сделай|добав|убери|обратно|исправ|помен|convert|change|redo|rewrite|update|fix|rest\s*api|fast\s*api)/i.test(text);
}
export function buildUserMessageContent(text: string, refs: ChatContextRef[], lang: UiLanguage = "ru"): string {
    const body = text.trim();
    if (!refs.length)
        return body;
    const prefix = refs
        .map((ref) => {
        if (lang === "en") {
            return ref.kind === "directory"
                ? `[Context — folder: ${ref.path}. Folder listing is attached below.]`
                : userWantsFileChange(body)
                    ? `[Context — file: ${ref.path}. Content below is CURRENT file. User asks to CHANGE it — write_file to «${ref.path}» with FULL new code in JSON "content". New content MUST differ from below; implement what user asked.]`
                    : `[Context — file: ${ref.path}. Content is attached below — do NOT read_file. ONE write_file to «${ref.path}» with full content in JSON "content" field. Empty file = write complete code.]`;
        }
        return ref.kind === "directory"
            ? `[Контекст — папка: ${ref.path}. Содержимое папки приложено ниже.]`
            : userWantsFileChange(body)
                ? `[Контекст — файл: ${ref.path}. Ниже ТЕКУЩИЙ код. Пользователь просит ИЗМЕНИТЬ — write_file на «${ref.path}» с полным НОВЫМ content в JSON. Код ДОЛЖЕН отличаться от текста ниже; сделай то, что просят.]`
                : `[Контекст — файл: ${ref.path}. Содержимое уже ниже — read_file НЕ нужен. Один write_file на «${ref.path}» с полным content в JSON. Пустой файл = напиши весь код целиком.]`;
    })
        .join("\n");
    return body ? `${prefix}\n\n${body}` : prefix;
}
export function readDraggedChatEntry(dataTransfer: DataTransfer): ChatContextRef | null {
    const raw = dataTransfer.getData(CHAT_ENTRY_DRAG_MIME);
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw) as ChatContextRef;
        if ((parsed.kind === "file" || parsed.kind === "directory") &&
            typeof parsed.path === "string" &&
            typeof parsed.name === "string") {
            return parsed;
        }
    }
    catch {
    }
    return null;
}
export function mergeContextRefs(current: ChatContextRef[], next: ChatContextRef): ChatContextRef[] {
    if (current.some((item) => item.path === next.path))
        return current;
    return [...current, next];
}
function electronFilePath(file: File): string | null {
    const path = (file as File & {
        path?: string;
    }).path;
    return typeof path === "string" && path.trim() ? path : null;
}
export function workspaceRefFromAbsolutePath(absPath: string, workspaceRoot: string, kind: ChatContextRef["kind"]): ChatContextRef | null {
    const root = normalizePath(workspaceRoot);
    const full = normalizePath(absPath);
    if (!root || !full.startsWith(root))
        return null;
    const relative = full.slice(root.length).replace(/^\//, "");
    if (!relative)
        return null;
    const name = relative.split("/").pop() ?? relative;
    return { kind, path: relative, name };
}
export function readDroppedWorkspaceRefs(dataTransfer: DataTransfer, workspaceRoot: string): ChatContextRef[] {
    if (!workspaceRoot.trim())
        return [];
    const refs: ChatContextRef[] = [];
    const seen = new Set<string>();
    for (const file of dataTransfer.files ?? []) {
        const absPath = electronFilePath(file);
        if (!absPath)
            continue;
        const isDirectory = !file.type && file.size === 0;
        const kind: ChatContextRef["kind"] = isDirectory ? "directory" : "file";
        if (!isDirectory && file.type.startsWith("image/"))
            continue;
        const ref = workspaceRefFromAbsolutePath(absPath, workspaceRoot, kind);
        if (!ref || seen.has(ref.path))
            continue;
        seen.add(ref.path);
        refs.push(ref);
    }
    return refs;
}
export type ComposerContextItem = {
    id: string;
    type: "file" | "text";
    label: string;
    path?: string;
    content?: string;
};
export function formatContextLabel(item: ComposerContextItem): string {
    return item.path ?? item.label;
}
