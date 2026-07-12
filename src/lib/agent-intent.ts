import type { ChatInteractionMode } from "./chat-modes";
export const AGENT_TOOL_NUDGE = "Continue the user's request using the available tools. Call a tool now — do not reply with only a plan or introduction.";
export function shouldRetryWithTools(_mode: ChatInteractionMode, _stepIndex: number, _nudgeCount: number, _maxNudges: number): boolean {
    return false;
}
