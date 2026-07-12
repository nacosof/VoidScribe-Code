import type { ChatMessage, ChatSession } from "../../src/types";
import { store } from "./store";
export type ChatPersistedState = {
    sessions: ChatSession[];
    activeId: string;
};
const MAX_ACTIVITIES_PER_MESSAGE = 120;
function compactMessage(message: ChatMessage): ChatMessage {
    const activities = message.agentActivities;
    const trimmedActivities = activities && activities.length > MAX_ACTIVITIES_PER_MESSAGE
        ? activities.slice(-MAX_ACTIVITIES_PER_MESSAGE)
        : activities;
    return {
        ...message,
        images: message.images?.map(({ id, name, mediaType }) => ({
            id,
            name,
            mediaType,
            dataUrl: "",
        })),
        agentActivities: trimmedActivities,
    };
}
export function compactChatState(state: ChatPersistedState): ChatPersistedState {
    return {
        activeId: state.activeId,
        sessions: state.sessions.map((session) => ({
            ...session,
            messages: session.messages.map(compactMessage),
        })),
    };
}
export function loadChatPersistedState(): ChatPersistedState | null {
    const raw = store.get("chatState");
    if (!raw || typeof raw !== "object")
        return null;
    const parsed = raw as ChatPersistedState;
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    if (!sessions.length)
        return null;
    const activeId = typeof parsed.activeId === "string" &&
        sessions.some((session) => session.id === parsed.activeId)
        ? parsed.activeId
        : sessions[0]!.id;
    return { sessions, activeId };
}
export function saveChatPersistedState(state: ChatPersistedState): void {
    store.set("chatState", compactChatState(state));
}
