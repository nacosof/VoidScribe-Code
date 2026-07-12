import { type AiRuntimeSettings } from "../ai";
import { type AgentInteractionMode, type OpenAiMessage } from "../agent-tools";
import type { AgentSchedulerProvider } from "./provider-types";
type AnthropicTextBlock = {
    type: "text";
    text: string;
};
type AnthropicImageBlock = {
    type: "image";
    source: {
        type: "base64";
        media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
        data: string;
    };
};
type AnthropicToolUseBlock = {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
};
type AnthropicToolResultBlock = {
    type: "tool_result";
    tool_use_id: string;
    content: string | AnthropicContentBlock[];
};
type AnthropicContentBlock = AnthropicTextBlock | AnthropicImageBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;
type AnthropicMessage = {
    role: "user" | "assistant";
    content: string | AnthropicContentBlock[];
};
export declare function splitAgentMessages(messages: OpenAiMessage[]): {
    system: string;
    messages: AnthropicMessage[];
};
export type AnthropicSchedulerProviderOptions = {
    settings: AiRuntimeSettings;
    openAiMessages: OpenAiMessage[];
    projectMature: boolean;
    interactionMode?: AgentInteractionMode;
};
export declare function createAnthropicSchedulerProvider(options: AnthropicSchedulerProviderOptions): AgentSchedulerProvider;
export {};
