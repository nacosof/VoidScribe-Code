import { type AgentInteractionMode, type AgentToolEvent, type OpenAiMessage } from "./agent-tools";
import type { AiRuntimeSettings } from "./ai";
import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
export { splitAgentMessages } from "./agent-runtime/anthropic-provider";
export declare function runAnthropicAgentToolLoop(input: {
    settings: AiRuntimeSettings;
    messages: OpenAiMessage[];
    workspaceRoot: string;
    interactionMode?: AgentInteractionMode;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
    onEvent: (event: AgentToolEvent) => void;
    onTranscript?: (turns: AgentTranscriptTurn[]) => void;
}): Promise<void>;
