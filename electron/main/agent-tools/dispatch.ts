import { isMcpToolName } from "../mcp-service";
import { WorkspaceError } from "../workspace";
import type { AgentToolResult } from "../agent-tool-result";
import type { ToolExecutionContext } from "./context";
import {
    handleListDirectory,
    handleReadFile,
    handleWorkspaceSnapshot,
    handleGrep,
} from "./handlers/read";
import { handleWriteFile, handleSearchReplace } from "./handlers/write";
import { handleRunCommand, handleReadLintErrors } from "./handlers/shell";
import {
    handleListFileHistory,
    handleReadFileHistory,
    handleRestoreFile,
} from "./handlers/history";
import {
    handleCapturePagePreview,
    handleDeletePath,
    handleDiffFiles,
    handleMcpTool,
} from "./handlers/misc";

const HANDLERS: Record<string, (ctx: ToolExecutionContext) => Promise<AgentToolResult>> = {
    list_directory: handleListDirectory,
    read_file: handleReadFile,
    workspace_snapshot: handleWorkspaceSnapshot,
    grep: handleGrep,
    write_file: handleWriteFile,
    search_replace: handleSearchReplace,
    run_command: handleRunCommand,
    read_lint_errors: handleReadLintErrors,
    list_file_history: handleListFileHistory,
    read_file_history: handleReadFileHistory,
    restore_file: handleRestoreFile,
    delete_path: handleDeletePath,
    capture_page_preview: handleCapturePagePreview,
    diff_files: handleDiffFiles,
};

export async function dispatchBuiltinTool(ctx: ToolExecutionContext): Promise<AgentToolResult> {
    const handler = HANDLERS[ctx.name];
    if (handler)
        return handler(ctx);
    if (isMcpToolName(ctx.name))
        return handleMcpTool(ctx);
    throw new WorkspaceError(`Неизвестный инструмент: ${ctx.name}`);
}
