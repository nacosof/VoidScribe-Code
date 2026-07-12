import type OpenAI from "openai";
import type { UserAiProviderId } from "../../src/lib/providers";
import type { OpenAiMessage } from "./agent-tools";
export declare function estimateMessagesChars(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): number;
export declare function trimWorkspaceSnapshotInSystem(systemContent: string, maxSnapshotChars?: number): string;
export declare function weightBasedTrimMessages(messages: OpenAiMessage[], charBudget: number): boolean;
export type CompactMessagesOptions = {
    model?: string;
    aggressive?: boolean;
};
export declare function compactMessagesForApi(messages: OpenAiMessage[], provider: UserAiProviderId, options?: CompactMessagesOptions): boolean;
export declare function isLikelyContextOverflow400(err: unknown): boolean;
