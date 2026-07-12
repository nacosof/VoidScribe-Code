import type { ChatContextRef } from "@/types";

export const CHAT_ENTRY_DRAG_MIME = "application/voidscribe-entry";

export function buildUserMessageContent(
  text: string,
  refs: ChatContextRef[]
): string {
  const body = text.trim();
  if (!refs.length) return body;

  const prefix = refs
    .map((ref) =>
      ref.kind === "directory"
        ? `[Контекст — папка: ${ref.path}]`
        : `[Контекст — файл: ${ref.path}]`
    )
    .join("\n");

  return body ? `${prefix}\n\n${body}` : prefix;
}

export function readDraggedChatEntry(
  dataTransfer: DataTransfer
): ChatContextRef | null {
  const raw = dataTransfer.getData(CHAT_ENTRY_DRAG_MIME);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ChatContextRef;
    if (
      (parsed.kind === "file" || parsed.kind === "directory") &&
      typeof parsed.path === "string" &&
      typeof parsed.name === "string"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function mergeContextRefs(
  current: ChatContextRef[],
  next: ChatContextRef
): ChatContextRef[] {
  if (current.some((item) => item.path === next.path)) return current;
  return [...current, next];
}
