function normalizePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^\.\//, "");
}
function contentFingerprint(content: string): string {
    return `${content.length}:${content.slice(0, 160)}`;
}
export class AgentPathEditGuard {
    private readonly patchFails = new Map<string, number>();
    private readonly writeNoopFails = new Map<string, number>();
    private readonly lastNoopFingerprint = new Map<string, string>();
    recordPatchFail(path: string): void {
        const key = normalizePath(path);
        this.patchFails.set(key, (this.patchFails.get(key) ?? 0) + 1);
    }
    recordWriteSuccess(path: string): void {
        const key = normalizePath(path);
        this.patchFails.delete(key);
        this.writeNoopFails.delete(key);
        this.lastNoopFingerprint.delete(key);
    }
    recordWriteNoopFail(path: string, content: string): number {
        const key = normalizePath(path);
        const fingerprint = contentFingerprint(content);
        const sameAsLast = this.lastNoopFingerprint.get(key) === fingerprint;
        this.lastNoopFingerprint.set(key, fingerprint);
        const fails = (this.writeNoopFails.get(key) ?? 0) + 1;
        this.writeNoopFails.set(key, fails);
        return fails;
    }
    isPatchBlocked(path: string): boolean {
        const key = normalizePath(path);
        return (this.patchFails.get(key) ?? 0) >= 2;
    }
    isWriteBlocked(path: string): boolean {
        const key = normalizePath(path);
        return (this.writeNoopFails.get(key) ?? 0) >= 3;
    }
    patchFailCount(path: string): number {
        const key = normalizePath(path);
        return this.patchFails.get(key) ?? 0;
    }
    writeNoopCount(path: string): number {
        const key = normalizePath(path);
        return this.writeNoopFails.get(key) ?? 0;
    }
    reset(): void {
        this.patchFails.clear();
        this.writeNoopFails.clear();
        this.lastNoopFingerprint.clear();
    }
}
const guardsByWorkspace = new Map<string, AgentPathEditGuard>();
export function pathEditGuardForWorkspace(workspaceRoot: string): AgentPathEditGuard {
    const key = workspaceRoot.trim();
    let guard = guardsByWorkspace.get(key);
    if (!guard) {
        guard = new AgentPathEditGuard();
        guardsByWorkspace.set(key, guard);
    }
    return guard;
}
export function resetPathEditGuard(workspaceRoot: string): void {
    guardsByWorkspace.get(workspaceRoot.trim())?.reset();
}
export function userIntentRequestsFileChange(intent: string): boolean {
    return /(?:передел|измен|сделай|добав|обратно|исправ|помен|convert|change|redo|rewrite|update|fix|rest\s*api|fast\s*api)/i.test(intent);
}
export function userIntentRequestsDelete(intent: string): boolean {
    return /(?:удали|delete|remove\s+(?:the\s+)?file|убери\s+файл|стер(?:и|еть)\s+файл)/i.test(intent);
}
export function userIntentRequestsCreate(intent: string): boolean {
    return /(?:создай|создать|create|new\s+file|добавь\s+файл)/i.test(intent);
}
