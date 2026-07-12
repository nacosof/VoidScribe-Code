import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
import type { UserAiProviderId } from "../../src/lib/providers";
import type { OpenAiMessage } from "./agent-tools";
export declare function compactTranscriptTurnForApi(turn: AgentTranscriptTurn): AgentTranscriptTurn;
export declare function compactAgentTranscriptForApi(turns: AgentTranscriptTurn[], options?: {
    provider?: UserAiProviderId;
}): AgentTranscriptTurn[];
export declare function compactInflightAgentMessages(messages: OpenAiMessage[], options?: {
    provider?: UserAiProviderId;
}): void;
