import type { PendingFileChange } from "@/types";
import { createId } from "@/lib/chat-sessions";
const PENDING_CHANGES_KEY = "voidscribe-pending-changes-v1";
export function loadPendingChanges(): Record<string, PendingFileChange[]> {
    try {
        const raw = localStorage.getItem(PENDING_CHANGES_KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw) as Record<string, PendingFileChange[]>;
        if (!parsed || typeof parsed !== "object")
            return {};
        const next: Record<string, PendingFileChange[]> = {};
        for (const [sessionId, changes] of Object.entries(parsed)) {
            if (!Array.isArray(changes))
                continue;
            next[sessionId] = changes.filter((change) => change &&
                typeof change.id === "string" &&
                typeof change.path === "string" &&
                (change.kind === "created" ||
                    change.kind === "modified" ||
                    change.kind === "deleted"));
        }
        return next;
    }
    catch {
        return {};
    }
}
export function savePendingChanges(data: Record<string, PendingFileChange[]>): void {
    try {
        localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(data));
    }
    catch {
    }
}
function normalizePendingPath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^\.\//, "");
}
export function removePendingByPath(store: Record<string, PendingFileChange[]>, sessionId: string, path: string): Record<string, PendingFileChange[]> {
    const norm = normalizePendingPath(path);
    const list = store[sessionId] ?? [];
    const nextList = list.filter((item) => normalizePendingPath(item.path) !== norm);
    if (nextList.length === list.length)
        return store;
    return { ...store, [sessionId]: nextList };
}
export function findPendingByPath(store: Record<string, PendingFileChange[]>, sessionId: string, path: string): PendingFileChange | undefined {
    const norm = normalizePendingPath(path);
    return (store[sessionId] ?? []).find((item) => normalizePendingPath(item.path) === norm);
}
export function addPendingChange(store: Record<string, PendingFileChange[]>, sessionId: string, input: Omit<PendingFileChange, "id">): Record<string, PendingFileChange[]> {
    const list = store[sessionId] ?? [];
    const existing = list.findIndex((item) => item.path === input.path);
    const change: PendingFileChange = {
        id: existing >= 0 ? list[existing]!.id : createId(),
        ...input,
        previousContent: existing >= 0
            ? list[existing]!.previousContent ?? input.previousContent
            : input.previousContent,
    };
    const nextList = existing >= 0
        ? list.map((item, index) => (index === existing ? change : item))
        : [...list, change];
    return { ...store, [sessionId]: nextList };
}
