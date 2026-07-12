export type AgentToolCallRecord = {
    id: string;
    name: string;
    arguments: string;
    detail?: string;
};
export type AgentToolResultRecord = {
    toolCallId: string;
    name: string;
    detail?: string;
    ok: boolean;
    text: string;
};
export type AgentTranscriptTurn = {
    text?: string;
    toolCalls?: AgentToolCallRecord[];
    toolResults?: AgentToolResultRecord[];
};
