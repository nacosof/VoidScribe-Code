export declare function grepWorkspace(workspaceRoot: string, pattern: string, options?: {
    path?: string;
    glob?: string;
    maxResults?: number;
}): Promise<string>;
