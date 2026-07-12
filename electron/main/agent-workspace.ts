import { stat } from "fs/promises";
import { dirname } from "path";
import { WorkspaceError, normalizeAgentRelativePath, resolveAgentRelativePath, resolveWorkspacePath, } from "./workspace";
import { scaffoldStackMismatchMessage } from "./project-scaffold";
export function validateAgentCwd(workspaceRoot: string, cwd?: string): string {
    const rel = normalizeAgentRelativePath(cwd || ".");
    resolveWorkspacePath(workspaceRoot, rel);
    return rel;
}
export function validateDeletePath(workspaceRoot: string, path: string): string {
    const rel = resolveAgentRelativePath(workspaceRoot, path);
    if (rel === ".")
        throw new WorkspaceError("Нельзя удалить корень workspace.");
    return rel;
}
export async function validateWriteFile(workspaceRoot: string, path: string): Promise<string> {
    const rel = resolveAgentRelativePath(workspaceRoot, path);
    if (rel === ".")
        throw new WorkspaceError("Укажите путь файла.");
    const parent = dirname(resolveWorkspacePath(workspaceRoot, rel));
    await stat(parent).catch(() => null);
    return rel;
}
export function validateAgentCommand(command: string, userIntent = ""): string {
    const trimmed = command.trim();
    if (!trimmed)
        throw new WorkspaceError("Введите команду.");
    if (/\b(rm\s+-rf\s+[./]*|rmdir\s+\/s\s+[./]*|del\s+\/s\s+[./]*)$/i.test(trimmed)) {
        throw new WorkspaceError("Опасная команда удаления заблокирована.");
    }
    const mismatch = scaffoldStackMismatchMessage(trimmed, userIntent);
    if (mismatch)
        throw new WorkspaceError(mismatch);
    return trimmed;
}
export async function getWorkspaceContextForAgent(workspaceRoot: string): Promise<string> {
    const { snapshotWorkspaceTextFiles } = await import("./workspace");
    return snapshotWorkspaceTextFiles(workspaceRoot, 160);
}
