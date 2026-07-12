import type { UserAiProviderId } from "./providers";
export declare const CHARS_PER_TOKEN = 4;
export type ModelCapability = {
    contextWindowTokens: number;
    reservedOutputTokens: number;
    recommendedForAgent: boolean;
    label?: string;
};
export declare function resolveModelCapability(provider: UserAiProviderId, model: string): ModelCapability;
export declare function resolveInputCharBudget(provider: UserAiProviderId, model: string): number;
export declare function recommendedAgentModelHint(provider: UserAiProviderId): string;
