export declare function validateAgentCwd(workspaceRoot: string, cwd?: string): string;
export declare function validateDeletePath(workspaceRoot: string, path: string): string;
export declare function validateWriteFile(workspaceRoot: string, path: string): Promise<string>;
export declare function validateAgentCommand(command: string, userIntent?: string): string;
export declare function getWorkspaceContextForAgent(workspaceRoot: string): Promise<string>;
