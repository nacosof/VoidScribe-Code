import type {
  AgentToolCallRecord,
  AgentToolResultRecord,
  AgentTranscriptTurn,
} from "../../../src/lib/agent-transcript";

export class AgentTranscriptCollector {
  private turns: AgentTranscriptTurn[] = [];
  private current: AgentTranscriptTurn | null = null;

  beginToolTurn(text?: string) {
    this.current = {
      text: text?.trim() ? text : undefined,
      toolCalls: [],
      toolResults: [],
    };
  }

  recordToolCall(input: AgentToolCallRecord) {
    if (!this.current) {
      this.beginToolTurn();
    }
    this.current!.toolCalls!.push(input);
  }

  recordToolResult(input: AgentToolResultRecord) {
    if (!this.current) return;
    this.current.toolResults!.push(input);
  }

  finishToolTurn() {
    if (!this.current) return;
    const hasTools = (this.current.toolCalls?.length ?? 0) > 0;
    if (hasTools) {
      this.turns.push(this.current);
    }
    this.current = null;
  }

  recordFinalText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.turns.push({ text: trimmed });
  }

  snapshot(): AgentTranscriptTurn[] {
    return [...this.turns];
  }
}
