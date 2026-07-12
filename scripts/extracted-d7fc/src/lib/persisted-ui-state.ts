import { createChatSession, type ChatSession } from "@/lib/chat-sessions";
import type { PendingFileChange } from "@/types";

const CHAT_STATE_KEY = "voidscribe-chat-state-v1";
const PENDING_CHANGES_KEY = "voidscribe-pending-changes-v1";

type ChatPersisted = {
  sessions: ChatSession[];
  activeId: string;
};

function isChatSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== "object") return false;
  const session = value as ChatSession;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    Array.isArray(session.messages) &&
    typeof session.draft === "string" &&
    Array.isArray(session.contextRefs)
  );
}

export function loadChatState(defaultTitle: string): ChatPersisted | null {
  try {
    const raw = localStorage.getItem(CHAT_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ChatPersisted;
    const sessions = parsed.sessions?.filter(isChatSession) ?? [];
    if (!sessions.length) return null;

    const activeId = sessions.some((session) => session.id === parsed.activeId)
      ? parsed.activeId
      : sessions[0]!.id;

    return { sessions, activeId };
  } catch {
    return null;
  }
}

export function saveChatState(sessions: ChatSession[], activeId: string): void {
  try {
    localStorage.setItem(
      CHAT_STATE_KEY,
      JSON.stringify({ sessions, activeId } satisfies ChatPersisted)
    );
  } catch {
    /* ignore quota */
  }
}

export function createInitialChatState(defaultTitle: string): ChatPersisted {
  const restored = loadChatState(defaultTitle);
  if (restored) return restored;

  const session = createChatSession(defaultTitle);
  return { sessions: [session], activeId: session.id };
}

export function loadPendingChanges(): Record<string, PendingFileChange[]> {
  try {
    const raw = localStorage.getItem(PENDING_CHANGES_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, PendingFileChange[]>;
    if (!parsed || typeof parsed !== "object") return {};

    const next: Record<string, PendingFileChange[]> = {};
    for (const [sessionId, changes] of Object.entries(parsed)) {
      if (!Array.isArray(changes)) continue;
      next[sessionId] = changes.filter(
        (change) =>
          change &&
          typeof change.id === "string" &&
          typeof change.path === "string" &&
          (change.kind === "created" || change.kind === "modified")
      );
    }
    return next;
  } catch {
    return {};
  }
}

export function savePendingChanges(
  data: Record<string, PendingFileChange[]>
): void {
  try {
    localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}
