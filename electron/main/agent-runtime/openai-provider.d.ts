import type OpenAI from "openai";
import { type AgentInteractionMode, type OpenAiMessage } from "../agent-tools";
import { type UserAiProviderId } from "../../../src/lib/providers";
import type { AgentToolEvent } from "./events";
import type { AgentSchedulerProvider } from "./provider-types";
export type OpenAiSchedulerProviderOptions = {
    client: OpenAI;
    model: string;
    provider?: UserAiProviderId;
    messages: OpenAiMessage[];
    maxOutputTokens?: number;
    interactionMode?: AgentInteractionMode;
    onEvent: (event: AgentToolEvent) => void;
};
export declare function createOpenAiSchedulerProvider(options: OpenAiSchedulerProviderOptions): AgentSchedulerProvider & {
    appendUserContent(content: OpenAiMessage["content"]): void;
};
