export type ChatInteractionMode = "normal" | "gather" | "agent";

export const CHAT_INTERACTION_MODES: ChatInteractionMode[] = [
  "normal",
  "gather",
  "agent",
];

/** Read-only tools available in Gather mode (like Void). */
export const GATHER_TOOL_NAMES = new Set([
  "list_directory",
  "read_file",
  "grep",
  "read_lint_errors",
  "list_file_history",
  "read_file_history",
  "capture_page_preview",
]);

export function modeRequiresWorkspace(mode: ChatInteractionMode): boolean {
  return mode === "gather" || mode === "agent";
}

export function resolveEffectiveChatMode(
  mode: ChatInteractionMode | undefined,
  hasWorkspace: boolean
): ChatInteractionMode {
  const picked = mode ?? "normal";
  if (!hasWorkspace && modeRequiresWorkspace(picked)) return "normal";
  return picked;
}

export function isGatherReadOnlyTool(name: string): boolean {
  return GATHER_TOOL_NAMES.has(name);
}
