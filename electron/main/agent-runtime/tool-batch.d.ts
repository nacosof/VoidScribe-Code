import type { AgentToolResult } from "../agent-tool-result";
import type { AgentTranscriptTurn } from "../../../src/lib/agent-transcript";
import { AgentTranscriptCollector } from "./transcript-collector";
export type AgentToolCallRequest = {
    id: string;
    name: string;
    arguments: string;
};
export type AgentToolBatchResult = {
    call: AgentToolCallRequest;
    detail: string;
    result: AgentToolResult;
};
export declare function executeAgentToolBatch(input: {
    calls: AgentToolCallRequest[];
    executeTool: (call: AgentToolCallRequest) => Promise<AgentToolResult>;
    transcriptCollector: AgentTranscriptCollector;
}): Promise<AgentToolBatchResult[]>;
export type { AgentTranscriptTurn };
