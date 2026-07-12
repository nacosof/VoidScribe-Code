import type { ChatMessage } from "@/types";

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  draft: string;
  createdAt: number;
  updatedAt: number;
};

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createChatSession(title = "Новый чат"): ChatSession {
  const now = Date.now();
  return {
    id: createId(),
    title,
    messages: [],
    draft: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function deriveChatTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "Новый чат";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  if (text.length <= 28) return text;
  return `${text.slice(0, 28)}…`;
}

export function closeChatSession(
  sessions: ChatSession[],
  activeId: string,
  closingId: string
): { sessions: ChatSession[]; activeId: string } {
  if (sessions.length === 1) {
    const next = createChatSession();
    return { sessions: [next], activeId: next.id };
  }

  const index = sessions.findIndex((s) => s.id === closingId);
  const remaining = sessions.filter((s) => s.id !== closingId);

  if (closingId !== activeId) {
    return { sessions: remaining, activeId };
  }

  const nextActive = remaining[Math.min(index, remaining.length - 1)]!;
  return { sessions: remaining, activeId: nextActive.id };
}
