import type { PendingFileChange } from "@/types";
import { createId } from "@/lib/chat-sessions";
import { normalizeWorkspacePath } from "@/shared/lib/paths";
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
    return normalizeWorkspacePath(path).replace(/^\.\//, "");
}

export function pendingChangesForWorkspace(changes: PendingFileChange[], workspacePath: string): PendingFileChange[] {
    const root = workspacePath.trim();
    if (!root)
        return [];
    return changes.filter((change) => change.workspacePath === root);
}

export function pendingChangesToPaths(changes: PendingFileChange[]): ReadonlySet<string> {
    const paths = new Set<string>();
    for (const change of changes) {
        paths.add(normalizePendingPath(change.path));
    }
    return paths;
}

export async function reconcilePendingStore(input: {
    store: Record<string, PendingFileChange[]>;
    workspacePath: string;
    sessionIds: string[];
    readFile: (path: string) => Promise<{
        ok: boolean;
        content?: string;
    }>;
}): Promise<Record<string, PendingFileChange[]>> {
    const root = input.workspacePath.trim();
    const allowedSessions = new Set(input.sessionIds);
    const next: Record<string, PendingFileChange[]> = {};
    for (const [sessionId, changes] of Object.entries(input.store)) {
        if (!allowedSessions.has(sessionId))
            continue;
        const kept: PendingFileChange[] = [];
        for (const change of changes) {
            if (root && change.workspacePath !== root)
                continue;
            if (change.previousContent !== null && change.newContent === change.previousContent)
                continue;
            const disk = await input.readFile(change.path);
            if (change.kind === "modified" && change.previousContent !== null && disk.ok && disk.content === change.previousContent)
                continue;
            if (change.kind === "modified" && !disk.ok)
                continue;
            kept.push(change);
        }
        if (kept.length > 0)
            next[sessionId] = kept;
    }
    return next;
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
