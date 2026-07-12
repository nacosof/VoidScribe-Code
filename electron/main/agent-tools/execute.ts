import { WorkspaceEditOverlay } from "../agent-runtime/edit-overlay";
import { toolText, type AgentToolResult } from "../agent-tool-result";
import type { AgentToolEvent } from "../agent-runtime/events";
import type { ChatInteractionMode } from "../../../src/lib/chat-modes";
import { dispatchBuiltinTool } from "./dispatch";
import type { ToolExecutionContext } from "./context";
import { asErrorText, parseToolArgs, toolDetailForError } from "./utils";
import { summarizeCommandFailureForUser } from "../build-diagnostics";

export type AgentInteractionMode = ChatInteractionMode;

function emit(onEvent: (event: AgentToolEvent) => void, event: AgentToolEvent): void {
    onEvent(event);
}

export async function executeAgentTool(input: {
    workspaceRoot: string;
    name: string;
    argsJson: string;
    signal?: AbortSignal;
    onEvent: (event: AgentToolEvent) => void;
    userIntent?: string;
    interactionMode?: AgentInteractionMode;
}): Promise<AgentToolResult> {
    const { workspaceRoot, name, signal, onEvent, userIntent = "", interactionMode = "agent" } = input;
    if (interactionMode === "normal")
        return toolText("Tools are disabled in normal chat mode.", false);

    const args = parseToolArgs(input.argsJson);
    emit(onEvent, { type: "tool_start", name, detail: toolDetailForError(name, args, workspaceRoot) });

    try {
        const ctx: ToolExecutionContext = {
            workspaceRoot,
            name,
            args,
            signal,
            onEvent,
            userIntent,
            interactionMode,
            overlay: WorkspaceEditOverlay.forRoot(workspaceRoot),
        };
        const result = await dispatchBuiltinTool(ctx);
        emit(onEvent, {
            type: "tool_done",
            name,
            detail: toolDetailForError(name, args, workspaceRoot),
            failed: result.ok === false,
            error: result.ok === false
                ? (name === "run_command"
                    ? summarizeCommandFailureForUser({
                        command: String(args.command ?? "run_command"),
                        toolText: result.text,
                    })
                    : result.text.replace(/^Error:\s*/i, "").slice(0, 240))
                : undefined,
        });
        return result;
    }
    catch (err) {
        const message = asErrorText(err);
        emit(onEvent, { type: "tool_done", name, detail: toolDetailForError(name, args, workspaceRoot), failed: true, error: message });
        return toolText(`Error: ${message}`, false);
    }
}
