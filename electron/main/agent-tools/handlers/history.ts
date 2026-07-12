import { writeWorkspaceFile, WorkspaceError } from "../../workspace";
import { listFileHistory, readFileHistoryVersion } from "../../file-history";
import { formatFileContentForAgent } from "../../build-diagnostics";
import { toolText, type AgentToolResult } from "../../agent-tool-result";
import type { ToolExecutionContext } from "../context";
import { readStringArg } from "../utils";

export async function handleListFileHistory(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const list = await listFileHistory(ctx.workspaceRoot, readStringArg(ctx.args, "path") || undefined);
    return toolText(list.map((item) => `${item.id}\t${new Date(item.createdAt).toISOString()}\t${item.path}\t${item.source}`).join("\n") || "(no history)");
}

export async function handleReadFileHistory(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const record = await readFileHistoryVersion(ctx.workspaceRoot, readStringArg(ctx.args, "id"));
    if (!record)
        throw new WorkspaceError("Версия не найдена.");
    return toolText(formatFileContentForAgent(record.path, record.content));
}

export async function handleRestoreFile(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const record = await readFileHistoryVersion(ctx.workspaceRoot, readStringArg(ctx.args, "id"));
    if (!record)
        throw new WorkspaceError("Версия не найдена.");
    await writeWorkspaceFile(ctx.workspaceRoot, record.path, record.content, { historySource: "agent" });
    return toolText(`Restored ${record.path}`);
}
