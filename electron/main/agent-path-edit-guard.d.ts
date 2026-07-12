export declare class AgentPathEditGuard {
    private readonly patchFails;
    private readonly writeNoopFails;
    private readonly lastNoopFingerprint;
    recordPatchFail(path: string): void;
    recordWriteSuccess(path: string): void;
    recordWriteNoopFail(path: string, content: string): string | null;
    isPatchBlocked(path: string): boolean;
    isWriteBlocked(path: string): boolean;
    patchFailCount(path: string): number;
    writeNoopCount(path: string): number;
    reset(): void;
}
export declare function pathEditGuardForWorkspace(workspaceRoot: string): AgentPathEditGuard;
export declare function resetPathEditGuard(workspaceRoot: string): void;
