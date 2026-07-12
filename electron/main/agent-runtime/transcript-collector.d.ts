import type { AgentToolCallRecord, AgentToolResultRecord, AgentTranscriptTurn } from "../../../src/lib/agent-transcript";
export declare class AgentTranscriptCollector {
    private turns;
    private current;
    beginToolTurn(text?: string): void;
    recordToolCall(input: AgentToolCallRecord): void;
    recordToolResult(input: AgentToolResultRecord): void;
    finishToolTurn(): void;
    recordFinalText(text: string): void;
    snapshot(): AgentTranscriptTurn[];
}
