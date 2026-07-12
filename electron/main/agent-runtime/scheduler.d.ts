import type { AgentTranscriptTurn } from "../../../src/lib/agent-transcript";
import type { AgentToolEvent } from "./events";
import type { AgentSchedulerProvider } from "./provider-types";
import { type AgentToolBatchResult, type AgentToolCallRequest } from "./tool-batch";
export declare function runAgentScheduler(input: {
    provider: AgentSchedulerProvider;
    maxAgentSteps?: number;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
    onEvent: (event: AgentToolEvent) => void;
    onTranscript?: (turns: AgentTranscriptTurn[]) => void;
    executeTool: (call: AgentToolCallRequest) => Promise<{
        text: string;
        ok?: boolean;
        images?: unknown[];
    }>;
    afterToolResult?: (item: AgentToolBatchResult) => void | Promise<void>;
}): Promise<void>;
