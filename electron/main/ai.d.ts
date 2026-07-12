import OpenAI from "openai";
import type { ChatCompletionCreateParams, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { type PersistedSettings } from "./store";
import type { UserAiProviderId } from "../../src/lib/providers";
export type AiRuntimeSettings = PersistedSettings & {
    provider: UserAiProviderId;
    model: string;
    apiKey: string;
};
export declare function resolveRequestTimeoutMs(settings: Pick<AiRuntimeSettings, "requestTimeoutMs">): number;
export declare function resolveAnthropicMaxTokens(value?: number): number;
export declare function resolveAgentMaxOutputTokens(_provider?: UserAiProviderId, value?: number): number | undefined;
export declare function createOpenAiClient(settings?: AiRuntimeSettings): OpenAI;
export declare function streamOpenAiAgentCompletion(client: OpenAI, request: ChatCompletionCreateParams, options?: {
    signal?: AbortSignal;
    onGenerationChars?: (chars: number) => void;
}): Promise<OpenAI.Chat.Completions.ChatCompletion>;
export declare function streamChatCompletion(input: {
    messages: ChatCompletionMessageParam[];
    settings?: AiRuntimeSettings;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
}): Promise<void>;
