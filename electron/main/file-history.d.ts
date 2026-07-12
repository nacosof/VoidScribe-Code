type VersionRecord = {
    id: string;
    path: string;
    createdAt: number;
    content: string;
    source: "agent" | "user";
};
export declare function recordFileSnapshot(workspaceRoot: string, path: string, content: string, source?: "agent" | "user"): Promise<string>;
export declare function listFileHistory(workspaceRoot: string, path?: string): Promise<VersionRecord[]>;
export declare function readFileHistoryVersion(workspaceRoot: string, id: string): Promise<VersionRecord | null>;
export {};
