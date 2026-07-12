import { useCallback, useMemo, useState } from "react";
import type { AgentActivity, ChatMessage } from "@/types";
import {
  closeChatSession,
  createChatSession,
  deriveChatTitle,
  type ChatSession,
} from "@/lib/chat-sessions";

export function useChatSessions(defaultChatTitle: string) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    createChatSession(defaultChatTitle),
  ]);
  const [activeId, setActiveId] = useState(() => sessions[0]!.id);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? sessions[0]!,
    [sessions, activeId]
  );

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const createSession = useCallback(() => {
    const session = createChatSession(defaultChatTitle);
    setSessions((prev) => [...prev, session]);
    setActiveId(session.id);
    return session.id;
  }, [defaultChatTitle]);

  const closeSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const result = closeChatSession(prev, activeId, id, defaultChatTitle);
        setActiveId(result.activeId);
        return result.sessions;
      });
    },
    [activeId, defaultChatTitle]
  );

  const updateSession = useCallback(
    (id: string, patch: Partial<ChatSession>) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === id
            ? { ...session, ...patch, updatedAt: Date.now() }
            : session
        )
      );
    },
    []
  );

  const updateActiveDraft = useCallback(
    (draft: string) => {
      updateSession(activeSession.id, { draft });
    },
    [activeSession.id, updateSession]
  );

  const appendMessages = useCallback(
    (id: string, messages: ChatMessage[]) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== id) return session;
          const nextMessages = [...session.messages, ...messages];
          return {
            ...session,
            messages: nextMessages,
            title: deriveChatTitle(nextMessages, defaultChatTitle),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [defaultChatTitle]
  );

  const patchMessage = useCallback(
    (sessionId: string, messageId: string, content: string) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== sessionId) return session;
          const messages = session.messages.map((message) =>
            message.id === messageId ? { ...message, content } : message
          );
          return {
            ...session,
            messages,
            title: deriveChatTitle(messages, defaultChatTitle),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [defaultChatTitle]
  );

  const appendToMessage = useCallback(
    (sessionId: string, messageId: string, delta: string) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== sessionId) return session;
          const messages = session.messages.map((message) =>
            message.id === messageId
              ? { ...message, content: message.content + delta }
              : message
          );
          return {
            ...session,
            messages,
            title: deriveChatTitle(messages, defaultChatTitle),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [defaultChatTitle]
  );

  const appendMessageActivity = useCallback(
    (sessionId: string, messageId: string, activity: AgentActivity) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== sessionId) return session;
          const messages = session.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  activities: [...(message.activities ?? []), activity],
                }
              : message
          );
          return {
            ...session,
            messages,
            updatedAt: Date.now(),
          };
        })
      );
    },
    []
  );

  const clearActiveDraft = useCallback(() => {
    updateSession(activeSession.id, { draft: "" });
  }, [activeSession.id, updateSession]);

  const updateActiveContextRefs = useCallback(
    (contextRefs: ChatSession["contextRefs"]) => {
      updateSession(activeSession.id, { contextRefs });
    },
    [activeSession.id, updateSession]
  );

  const clearActiveSession = useCallback(() => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeId
          ? {
              ...session,
              messages: [],
              title: defaultChatTitle,
              draft: "",
              contextRefs: [],
              updatedAt: Date.now(),
            }
          : session
      )
    );
  }, [activeId, defaultChatTitle]);

  return {
    sessions,
    activeSession,
    activeId,
    selectSession,
    createSession,
    closeSession,
    updateActiveDraft,
    appendMessages,
    patchMessage,
    appendToMessage,
    appendMessageActivity,
    clearActiveDraft,
    clearActiveSession,
    updateActiveContextRefs,
  };
}
