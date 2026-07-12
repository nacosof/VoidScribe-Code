import type OpenAI from "openai";
import { type AgentInteractionMode, type AgentToolEvent, type OpenAiMessage } from "./agent-tools";
import type { UserAiProviderId } from "../../src/lib/providers";
import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
export declare function runAgentToolLoop(input: {
    client: OpenAI;
    model: string;
    provider?: UserAiProviderId;
    messages: OpenAiMessage[];
    workspaceRoot: string;
    maxOutputTokens?: number;
    maxAgentSteps?: number;
    interactionMode?: AgentInteractionMode;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
    onEvent: (event: AgentToolEvent) => void;
    onTranscript?: (turns: AgentTranscriptTurn[]) => void;
}): Promise<void>;
