import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatMessage } from "../../src/types";
import type { UserAiProviderId } from "../../src/lib/providers";
export type ChatVisionOptions = {
    provider?: UserAiProviderId;
    model?: string;
};
export declare function chatHistoryToOpenAiMessages(history: ChatMessage[], options?: ChatVisionOptions): ChatCompletionMessageParam[];
