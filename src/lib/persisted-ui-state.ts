import type { ChatSession } from "@/types";
import { createChatSession, createId } from "@/lib/chat-sessions";
const CHAT_STATE_KEY = "voidscribe-chat-state-v1";
type ChatPersisted = {
    sessions: ChatSession[];
    activeId: string;
};
function isChatSession(value: unknown): value is ChatSession {
    if (!value || typeof value !== "object")
        return false;
    const session = value as ChatSession;
    return (typeof session.id === "string" &&
        typeof session.title === "string" &&
        Array.isArray(session.messages) &&
        typeof session.createdAt === "number" &&
        typeof session.updatedAt === "number");
}
export function loadChatState(): ChatPersisted | null {
    try {
        const raw = localStorage.getItem(CHAT_STATE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw) as ChatPersisted;
        const sessions = parsed.sessions?.filter(isChatSession) ?? [];
        if (!sessions.length)
            return null;
        const activeId = sessions.some((session) => session.id === parsed.activeId)
            ? parsed.activeId
            : sessions[0]!.id;
        return { sessions, activeId };
    }
    catch {
        return null;
    }
}
export function saveChatState(sessions: ChatSession[], activeId: string): void {
    try {
        localStorage.setItem(CHAT_STATE_KEY, JSON.stringify({ sessions, activeId }));
    }
    catch {
    }
}
export function createInitialChatState(): ChatPersisted {
    const restored = loadChatState();
    if (restored)
        return restored;
    const session = createChatSession();
    return { sessions: [session], activeId: session.id };
}
const EDITOR_TABS_KEY = "voidscribe-editor-tabs-v1";
export type EditorTabsPersisted = {
    paths: string[];
    activePath: string | null;
};
type EditorTabsStore = Record<string, EditorTabsPersisted>;
function normalizeWorkspaceKey(workspacePath: string): string {
    return workspacePath.replace(/\\/g, "/").trim().toLowerCase();
}
export function loadEditorTabsForWorkspace(workspacePath: string): EditorTabsPersisted | null {
    try {
        const raw = localStorage.getItem(EDITOR_TABS_KEY);
        if (!raw)
            return null;
        const store = JSON.parse(raw) as EditorTabsStore;
        const entry = store[normalizeWorkspaceKey(workspacePath)];
        if (!entry || !Array.isArray(entry.paths))
            return null;
        const paths = entry.paths.filter((path): path is string => typeof path === "string" && path.trim().length > 0);
        if (!paths.length)
            return null;
        const activePath = typeof entry.activePath === "string" && entry.activePath.trim()
            ? entry.activePath
            : paths[0] ?? null;
        return { paths, activePath };
    }
    catch {
        return null;
    }
}
export function saveEditorTabsForWorkspace(workspacePath: string, state: EditorTabsPersisted): void {
    if (!workspacePath.trim())
        return;
    try {
        const raw = localStorage.getItem(EDITOR_TABS_KEY);
        const store: EditorTabsStore = raw ? (JSON.parse(raw) as EditorTabsStore) : {};
        store[normalizeWorkspaceKey(workspacePath)] = {
            paths: state.paths.map((path) => path.replace(/\\/g, "/")),
            activePath: state.activePath,
        };
        localStorage.setItem(EDITOR_TABS_KEY, JSON.stringify(store));
    }
    catch {
    }
}
export { createId };
