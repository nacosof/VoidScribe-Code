export declare function isDevServerCommand(command: string): boolean;
export type TerminalRunResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    cwd: string;
};
export type TerminalRunOptions = {
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    signal?: AbortSignal;
};
export declare function cancelActiveWorkspaceCommand(): boolean;
export declare function hasActiveWorkspaceCommand(): boolean;
export declare function runWorkspaceCommand(workspaceRoot: string, command: string, relativeCwd?: string, options?: TerminalRunOptions): Promise<TerminalRunResult>;
