import { ipcMain } from "electron";
import {
    beginChatRequest,
    cancelChatRequestWithCommands,
    endChatRequest,
    interruptAgentWork,
    isAbortError,
} from "../chat-requests";
import { streamAgentChat } from "../agent";
import { streamChatCompletion } from "../ai";
import { chatHistoryToOpenAiMessages } from "../chat-vision";
import { enrichChatHistory } from "../chat-context-enrich";
import { getSettings } from "../store";
import { assertWorkspaceRoot } from "../workspace";
import { WorkspaceEditOverlay } from "../agent-runtime/edit-overlay";
import { restoreChatCheckpoint } from "../chat-checkpoints";
import { listMcpServersStatus } from "../mcp-service";
import type { AgentEditorContext, ChatMessage } from "../../../src/types";
import type { AgentToolEvent } from "../agent-tools";
import type { IpcContext } from "./context";
import { fail, ok } from "./context";

export function registerChatHandlers(ctx: IpcContext): void {
    ipcMain.handle("chat:cancel", (_e, requestId: string) => ok({ cancelled: cancelChatRequestWithCommands(requestId) }));
    ipcMain.handle("agent:interrupt", () => ok({ cancelled: interruptAgentWork() }));

    ipcMain.handle("agent:flushStaged", async (_e, paths?: string[]) => {
        try {
            const workspaceRoot = assertWorkspaceRoot(ctx.getWorkspacePath());
            const overlay = WorkspaceEditOverlay.forRoot(workspaceRoot);
            const targetPaths = Array.isArray(paths) && paths.length
                ? paths.map((item) => String(item))
                : overlay.listPaths();
            const flushed: string[] = [];
            for (const path of targetPaths) {
                if (await overlay.flushPath(workspaceRoot, path)) {
                    flushed.push(path);
                }
                else {
                    overlay.acknowledgePath(path);
                }
            }
            return ok({ flushed });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("chat:restoreCheckpoint", async (_e, checkpoint) => {
        try {
            const workspaceRoot = assertWorkspaceRoot(ctx.getWorkspacePath());
            const restored = await restoreChatCheckpoint(workspaceRoot, checkpoint);
            return ok({ restored });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("mcp:listServers", async () => {
        try {
            return ok({ servers: await listMcpServersStatus() });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("chat:stream", async (_e, input: {
        requestId: string;
        messages: ChatMessage[];
        mode?: "normal" | "agent";
        editorContext?: AgentEditorContext;
    }) => {
        const signal = beginChatRequest(input.requestId);
        try {
            const settings = getSettings();
            const mode = input.mode ?? "normal";
            const workspace = ctx.getWorkspacePath().trim();
            const needsWorkspace = mode === "agent" || input.messages.some((message) => message.role === "user" && (message.contextRefs?.length ?? 0) > 0);
            if (needsWorkspace) {
                assertWorkspaceRoot(workspace);
            }
            const apiMessages = await enrichChatHistory(input.messages, workspace, mode);
            const onTextDelta = (delta: string) => ctx.send("chat:delta", { requestId: input.requestId, delta });
            const onEvent = (event: AgentToolEvent) => ctx.send("agent:event", { requestId: input.requestId, event });
            const onTranscript = (turns: unknown) => ctx.send("agent:transcript", { requestId: input.requestId, turns });

            if ((input.mode ?? "normal") === "normal") {
                await streamChatCompletion({
                    messages: chatHistoryToOpenAiMessages(apiMessages, {
                        provider: settings.provider,
                        model: settings.model,
                    }),
                    settings,
                    signal,
                    onTextDelta,
                });
            }
            else {
                await streamAgentChat({
                    messages: apiMessages,
                    workspaceRoot: assertWorkspaceRoot(workspace),
                    mode: input.mode,
                    editorContext: input.editorContext,
                    settings,
                    signal,
                    onTextDelta,
                    onEvent,
                    onTranscript,
                });
            }
            ctx.send("chat:done", { requestId: input.requestId });
            return ok({});
        }
        catch (err) {
            const message = isAbortError(err) ? "cancelled" : err instanceof Error ? err.message : String(err);
            ctx.send("chat:error", { requestId: input.requestId, error: message });
            return fail(err);
        }
        finally {
            endChatRequest(input.requestId);
        }
    });
}
