import {
    diffWorkspaceTextSnapshots,
    readWorkspaceFileIfExists,
    WorkspaceError,
} from "../../workspace";
import { recordFileSnapshot } from "../../file-history";
import { validateDeletePath } from "../../agent-workspace";
import { userIntentRequestsDelete } from "../../agent-path-edit-guard";
import { capturePagePreview } from "../../page-preview";
import { callMcpTool } from "../../mcp-service";
import { requestAgentApproval } from "../../agent-approval";
import { toolText, toolTextWithImages, type AgentToolResult } from "../../agent-tool-result";
import { emitToolEvent, type ToolExecutionContext } from "../context";
import { readStringArg } from "../utils";

export async function handleDeletePath(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const path = validateDeletePath(ctx.workspaceRoot, readStringArg(ctx.args, "path"));
    if (!userIntentRequestsDelete(ctx.userIntent)) {
        throw new WorkspaceError("delete_path запрещён — пользователь не просил удалять файл. " +
            "Для правок используй search_replace (точечная замена) или write_file с новым содержимым. " +
            "Не удаляй и не пересоздавай файлы, чтобы обойти ошибку «тот же текст».");
    }
    const diskContent = await readWorkspaceFileIfExists(ctx.workspaceRoot, path);
    if (diskContent === null) {
        throw new WorkspaceError(`Файл «${path}» не найден.`);
    }
    await recordFileSnapshot(ctx.workspaceRoot, path, diskContent, "agent");
    ctx.overlay.stageDelete(path, diskContent);
    await ctx.overlay.flushPath(ctx.workspaceRoot, path);
    emitToolEvent(ctx, {
        type: "file_change",
        path,
        kind: "deleted",
        previousContent: diskContent,
        newContent: "",
        staged: true,
    });
    return toolText(`Файл удалён: ${path}`);
}

export async function handleCapturePagePreview(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const preview = await capturePagePreview(readStringArg(ctx.args, "url"));
    return preview.images?.length ? toolTextWithImages(preview.text, preview.images) : toolText(preview.text);
}

export async function handleDiffFiles(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    return toolText(await diffWorkspaceTextSnapshots(ctx.workspaceRoot, String(ctx.args.paths ?? "").split(",")));
}

export async function handleMcpTool(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    if (ctx.interactionMode !== "agent") {
        throw new WorkspaceError("MCP tools are only available in Agent mode.");
    }
    const detail = `${ctx.name}\n${JSON.stringify(ctx.args ?? {}, null, 2).slice(0, 800)}`;
    const approval = await requestAgentApproval({
        kind: "mcp",
        toolName: ctx.name,
        title: "Разрешить MCP tool?",
        detail,
        fingerprint: `${ctx.name}:${JSON.stringify(ctx.args ?? {})}`.slice(0, 240),
        signal: ctx.signal,
    });
    if (approval !== "allow") {
        throw new WorkspaceError("Пользователь отклонил MCP tool.");
    }
    return toolText(await callMcpTool(ctx.name, ctx.args as Record<string, unknown>));
}
