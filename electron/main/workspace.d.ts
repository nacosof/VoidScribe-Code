export declare class WorkspaceError extends Error {
    constructor(message: string);
}
export type WorkspaceEntry = {
    name: string;
    path: string;
    kind: "file" | "directory";
    size?: number;
};
export declare function normalizeAgentRelativePath(input: string): string;
export declare function resolveAgentRelativePath(workspaceRoot: string, input: string): string;
export declare function assertWorkspaceRoot(workspaceRoot: string): string;
export declare function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string;
export declare function isWorkspaceFsMissingError(err: unknown): boolean;
export declare function isWorkspaceFsLockError(err: unknown): boolean;
export declare function listWorkspaceDirectory(workspaceRoot: string, relativePath?: string): Promise<WorkspaceEntry[]>;
export declare function readWorkspaceFile(workspaceRoot: string, relativePath: string): Promise<string>;
export declare function readWorkspaceFileIfExists(workspaceRoot: string, relativePath: string): Promise<string | null>;
export declare function writeWorkspaceFile(workspaceRoot: string, relativePath: string, content: string, _options?: {
    historySource?: "agent" | "user";
}): Promise<void>;
export declare function deleteWorkspaceFile(workspaceRoot: string, relativePath: string): Promise<void>;
export declare function deleteWorkspaceEntry(workspaceRoot: string, relativePath: string): Promise<void>;
export declare function snapshotWorkspaceTextFiles(workspaceRoot: string, maxEntries?: number): Promise<string>;
export declare function diffWorkspaceTextSnapshots(workspaceRoot: string, paths: string[]): Promise<string>;
