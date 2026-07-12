import type { AgentToolEvent } from "../agent-runtime/events";
import type { WorkspaceEditOverlay } from "../agent-runtime/edit-overlay";
import type { ChatInteractionMode } from "../../../src/lib/chat-modes";
import type { ToolArgs } from "./utils";

export type ToolExecutionContext = {
    workspaceRoot: string;
    name: string;
    args: ToolArgs;
    signal?: AbortSignal;
    onEvent: (event: AgentToolEvent) => void;
    userIntent: string;
    interactionMode: ChatInteractionMode;
    overlay: WorkspaceEditOverlay;
};

export function emitToolEvent(ctx: ToolExecutionContext, event: AgentToolEvent): void {
    ctx.onEvent(event);
}
