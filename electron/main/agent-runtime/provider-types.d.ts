import type { AgentToolCallRequest } from "./tool-batch";
export type SchedulerModelStep = {
    visibleText: string;
    toolCalls: AgentToolCallRequest[];
    finishReason?: string | null;
    truncatedOutput: boolean;
    truncatedPath?: string | null;
};
export type ChatTurn = {
    role: string;
    content?: unknown;
    tool_calls?: unknown[];
};
export type AgentSchedulerProvider = {
    getMessages(): ChatTurn[];
    completeModelStep(input: {
        modelStep: string;
        signal?: AbortSignal;
        onProgress: (chars: number) => void;
    }): Promise<SchedulerModelStep>;
    recordAssistantToolStep(step: SchedulerModelStep): void;
    recordToolBatchResults(results: Array<{
        call: AgentToolCallRequest;
        result: {
            text: string;
            ok?: boolean;
            images?: unknown[];
        };
    }>): void;
};
