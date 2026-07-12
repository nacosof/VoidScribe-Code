export type OverlayEntry = {
    baselineContent: string | null;
    content: string;
    kind: "created" | "modified";
    onDisk: boolean;
};
export type StagedFileChange = {
    path: string;
    kind: "created" | "modified";
    previousContent: string | null;
    newContent: string;
    onDisk: boolean;
};
export declare class WorkspaceEditOverlay {
    private static byRoot;
    static forRoot(workspaceRoot: string): WorkspaceEditOverlay;
    static dropRoot(workspaceRoot: string): void;
    private entries;
    private normalizePath;
    getEntry(path: string): OverlayEntry | undefined;
    getEffectiveContent(path: string, diskContent: string | null): string | null;
    readEffective(workspaceRoot: string, path: string): Promise<string | null>;
    stage(path: string, newContent: string, diskContent: string | null): StagedFileChange;
    flushPath(workspaceRoot: string, path: string): Promise<boolean>;
    flushAll(workspaceRoot: string): Promise<string[]>;
    revertPath(workspaceRoot: string, path: string, options?: {
        previousContent?: string | null;
        kind?: "created" | "modified";
    }): Promise<void>;
    revertAgentChange(workspaceRoot: string, payload: {
        path: string;
        previousContent: string | null;
        kind: "created" | "modified";
    }): Promise<void>;
    acknowledgePath(path: string): void;
    listPaths(): string[];
}
