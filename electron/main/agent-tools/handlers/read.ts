import {
    listWorkspaceDirectory,
    readWorkspaceFileIfExists,
    resolveAgentRelativePath,
    snapshotWorkspaceTextFiles,
    WorkspaceError,
} from "../../workspace";
import { formatFileContentForAgent } from "../../build-diagnostics";
import { grepWorkspace } from "../../workspace-grep";
import { toolText, type AgentToolResult } from "../../agent-tool-result";
import type { ToolExecutionContext } from "../context";
import { readStringArg } from "../utils";

export async function handleListDirectory(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const path = readStringArg(ctx.args, "path") || ".";
    const entries = await listWorkspaceDirectory(ctx.workspaceRoot, path);
    return toolText(entries.map((e) => `${e.kind === "directory" ? "dir " : "file"}\t${e.path}`).join("\n") || "(empty)");
}

export async function handleReadFile(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const path = resolveAgentRelativePath(ctx.workspaceRoot, readStringArg(ctx.args, "path"));
    const content = await ctx.overlay.readEffective(ctx.workspaceRoot, path);
    if (content === null)
        throw new WorkspaceError("Файл не найден.");
    return toolText(formatFileContentForAgent(path, content));
}

export async function handleWorkspaceSnapshot(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    return toolText(await snapshotWorkspaceTextFiles(ctx.workspaceRoot));
}

export async function handleGrep(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    return toolText(await grepWorkspace(ctx.workspaceRoot, readStringArg(ctx.args, "pattern"), {
        path: readStringArg(ctx.args, "path") || ".",
        glob: readStringArg(ctx.args, "glob") || undefined,
    }));
}
