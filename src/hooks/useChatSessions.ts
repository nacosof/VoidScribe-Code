import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatSession, ChatCheckpoint } from "@/types";
import { createChatSession, titleFromPrompt } from "@/lib/chat-sessions";
import { createInitialChatState, saveChatState } from "@/lib/persisted-ui-state";
const CHAT_SAVE_DEBOUNCE_MS = 400;
export function useChatSessions() {
    const initial = useMemo(() => createInitialChatState(), []);
    const [sessions, setSessions] = useState<ChatSession[]>(initial.sessions);
    const [activeSessionId, setActiveSessionId] = useState(initial.activeId);
    const [hydrated, setHydrated] = useState(false);
    const sessionsRef = useRef(sessions);
    const activeIdRef = useRef(activeSessionId);
    const saveTimerRef = useRef<number | null>(null);
    const commitSessions = useCallback((mapper: (sessions: ChatSession[]) => ChatSession[]) => {
        setSessions((prev) => {
            const next = mapper(prev);
            sessionsRef.current = next;
            return next;
        });
    }, []);
    activeIdRef.current = activeSessionId;
    useEffect(() => {
        sessionsRef.current = sessions;
    }, [sessions]);
    useEffect(() => {
        let cancelled = false;
        void window.voidscribe.getAppState().then((result) => {
            if (cancelled || !result.ok) {
                setHydrated(true);
                return;
            }
            const stored = result.chatState;
            if (stored?.sessions?.length) {
                setSessions(stored.sessions);
                setActiveSessionId(stored.activeId);
            }
            setHydrated(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const flushChatSave = useCallback(() => {
        const payload = {
            sessions: sessionsRef.current,
            activeId: activeIdRef.current,
        };
        saveChatState(payload.sessions, payload.activeId);
        void window.voidscribe.saveChatState(payload);
    }, []);
    useEffect(() => {
        if (!hydrated)
            return;
        saveChatState(sessions, activeSessionId);
        if (saveTimerRef.current)
            window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(flushChatSave, CHAT_SAVE_DEBOUNCE_MS);
        return () => {
            if (saveTimerRef.current)
                window.clearTimeout(saveTimerRef.current);
        };
    }, [sessions, activeSessionId, hydrated, flushChatSave]);
    useEffect(() => {
        if (!hydrated)
            return;
        const onUnload = () => flushChatSave();
        window.addEventListener("beforeunload", onUnload);
        return () => {
            window.removeEventListener("beforeunload", onUnload);
            flushChatSave();
        };
    }, [hydrated, flushChatSave]);
    const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null, [sessions, activeSessionId]);
    const newSession = useCallback(() => {
        const session = createChatSession();
        commitSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
    }, [commitSessions]);
    const ensureSession = useCallback((): string => {
        const current = sessionsRef.current;
        if (current.length > 0) {
            const activeId = current.some((session) => session.id === activeIdRef.current)
                ? activeIdRef.current
                : current[0]!.id;
            if (activeId !== activeIdRef.current) {
                setActiveSessionId(activeId);
            }
            return activeId;
        }
        const session = createChatSession();
        sessionsRef.current = [session];
        setSessions([session]);
        setActiveSessionId(session.id);
        return session.id;
    }, []);
    const addMessage = useCallback((sessionId: string, message: ChatMessage) => {
        commitSessions((prev) => prev.map((session) => session.id === sessionId
            ? {
                ...session,
                title: session.messages.length === 0 && message.role === "user"
                    ? titleFromPrompt(message.content)
                    : session.title,
                messages: [...session.messages, message],
                updatedAt: Date.now(),
            }
            : session));
    }, [commitSessions]);
    const updateMessage = useCallback((sessionId: string, messageId: string, patch: Partial<ChatMessage>) => {
        commitSessions((prev) => prev.map((session) => session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((message) => message.id === messageId ? { ...message, ...patch } : message),
                updatedAt: Date.now(),
            }
            : session));
    }, [commitSessions]);
    const closeSession = useCallback((id: string) => {
        commitSessions((prev) => {
            const next = prev.filter((session) => session.id !== id);
            if (!next.length) {
                setActiveSessionId("");
                return [];
            }
            if (activeSessionId === id)
                setActiveSessionId(next[0]!.id);
            return next;
        });
    }, [activeSessionId, commitSessions]);
    const clearSession = useCallback((id: string) => {
        commitSessions((prev) => prev.map((session) => session.id === id
            ? { ...session, messages: [], title: "New chat", updatedAt: Date.now() }
            : session));
    }, [commitSessions]);
    const appendMessageDelta = useCallback((sessionId: string, messageId: string, delta: string) => {
        if (!delta)
            return;
        commitSessions((prev) => prev.map((session) => session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((message) => message.id === messageId
                    ? { ...message, content: message.content + delta }
                    : message),
                updatedAt: Date.now(),
            }
            : session));
    }, [commitSessions]);
    const getSessionMessages = useCallback((sessionId: string) => sessionsRef.current.find((session) => session.id === sessionId)?.messages ?? [], []);
    const getMessage = useCallback((sessionId: string, messageId: string) => {
        return sessionsRef.current
            .find((session) => session.id === sessionId)
            ?.messages.find((message) => message.id === messageId);
    }, []);
    const addCheckpoint = useCallback((sessionId: string, checkpoint: ChatCheckpoint) => {
        commitSessions((prev) => prev.map((session) => session.id === sessionId
            ? {
                ...session,
                checkpoints: [...(session.checkpoints ?? []), checkpoint],
                updatedAt: Date.now(),
            }
            : session));
    }, [commitSessions]);
    return {
        sessions,
        activeSession,
        activeSessionId,
        setActiveSessionId,
        newSession,
        ensureSession,
        addMessage,
        appendMessageDelta,
        getSessionMessages,
        getMessage,
        updateMessage,
        addCheckpoint,
        closeSession,
        clearSession,
    };
}
