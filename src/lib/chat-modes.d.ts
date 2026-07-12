export type ChatInteractionMode = "normal" | "agent";
export declare const CHAT_INTERACTION_MODES: ChatInteractionMode[];
export declare function normalizeChatMode(mode: ChatInteractionMode | "gather" | undefined): ChatInteractionMode;
export declare function modeRequiresWorkspace(mode: ChatInteractionMode): boolean;
export declare function resolveEffectiveChatMode(mode: ChatInteractionMode | "gather" | undefined, hasWorkspace: boolean): ChatInteractionMode;
