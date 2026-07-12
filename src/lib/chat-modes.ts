export type ChatInteractionMode = "normal" | "agent";
export const CHAT_INTERACTION_MODES: ChatInteractionMode[] = ["normal", "agent"];
export function normalizeChatMode(mode: ChatInteractionMode | "gather" | undefined): ChatInteractionMode {
    if (mode === "normal" || mode === "agent")
        return mode;
    return "agent";
}
export function modeRequiresWorkspace(mode: ChatInteractionMode): boolean {
    return mode === "agent";
}
export function resolveEffectiveChatMode(mode: ChatInteractionMode | "gather" | undefined, hasWorkspace: boolean): ChatInteractionMode {
    const picked = normalizeChatMode(mode);
    if (!hasWorkspace && modeRequiresWorkspace(picked))
        return "normal";
    return picked;
}
