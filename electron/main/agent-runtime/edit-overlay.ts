import { deleteWorkspaceEntry, deleteWorkspaceFile, isWorkspaceFsMissingError, readWorkspaceFileIfExists, writeWorkspaceFile, } from "../workspace";
export type OverlayEntry = {
    baselineContent: string | null;
    content: string;
    kind: "created" | "modified" | "deleted";
    onDisk: boolean;
};
export type StagedFileChange = {
    path: string;
    kind: "created" | "modified" | "deleted";
    previousContent: string | null;
    newContent: string;
    onDisk: boolean;
};
export class WorkspaceEditOverlay {
    private static byRoot = new Map<string, WorkspaceEditOverlay>();
    static forRoot(workspaceRoot: string): WorkspaceEditOverlay {
        const key = workspaceRoot.trim();
        let overlay = WorkspaceEditOverlay.byRoot.get(key);
        if (!overlay) {
            overlay = new WorkspaceEditOverlay();
            WorkspaceEditOverlay.byRoot.set(key, overlay);
        }
        return overlay;
    }
    static dropRoot(workspaceRoot: string) {
        WorkspaceEditOverlay.byRoot.delete(workspaceRoot.trim());
    }
    private entries = new Map<string, OverlayEntry>();
    private normalizePath(path: string): string {
        return path.replace(/\\/g, "/").replace(/^\.\//, "");
    }
    getEntry(path: string): OverlayEntry | undefined {
        return this.entries.get(this.normalizePath(path));
    }
    getEffectiveContent(path: string, diskContent: string | null): string | null {
        const entry = this.getEntry(path);
        if (entry?.kind === "deleted")
            return diskContent;
        if (entry)
            return entry.content;
        return diskContent;
    }
    async readEffective(workspaceRoot: string, path: string): Promise<string | null> {
        const disk = await readWorkspaceFileIfExists(workspaceRoot, path);
        return this.getEffectiveContent(path, disk);
    }
    stage(path: string, newContent: string, diskContent: string | null): StagedFileChange {
        const normalized = this.normalizePath(path);
        let entry = this.entries.get(normalized);
        if (!entry) {
            entry = {
                baselineContent: diskContent,
                content: newContent,
                kind: diskContent === null ? "created" : "modified",
                onDisk: false,
            };
            this.entries.set(normalized, entry);
        }
        else {
            entry.content = newContent;
        }
        return {
            path: normalized,
            kind: entry.kind,
            previousContent: entry.baselineContent,
            newContent: entry.content,
            onDisk: entry.onDisk,
        };
    }
    stageDelete(path: string, diskContent: string | null): StagedFileChange {
        const normalized = this.normalizePath(path);
        const entry: OverlayEntry = {
            baselineContent: diskContent,
            content: "",
            kind: "deleted",
            onDisk: false,
        };
        this.entries.set(normalized, entry);
        return {
            path: normalized,
            kind: "deleted",
            previousContent: diskContent,
            newContent: "",
            onDisk: false,
        };
    }
    async flushPath(workspaceRoot: string, path: string): Promise<boolean> {
        const normalized = this.normalizePath(path);
        const entry = this.entries.get(normalized);
        if (!entry || entry.onDisk)
            return false;
        if (entry.kind === "deleted") {
            await deleteWorkspaceFile(workspaceRoot, normalized);
            entry.onDisk = true;
            return true;
        }
        await writeWorkspaceFile(workspaceRoot, normalized, entry.content, {
            historySource: "agent",
        });
        entry.onDisk = true;
        return true;
    }
    async flushAll(workspaceRoot: string): Promise<string[]> {
        const flushed: string[] = [];
        for (const path of this.entries.keys()) {
            if (await this.flushPath(workspaceRoot, path)) {
                flushed.push(path);
            }
        }
        return flushed;
    }
    async revertPath(workspaceRoot: string, path: string, options?: {
        previousContent?: string | null;
        kind?: "created" | "modified" | "deleted";
    }): Promise<void> {
        const normalized = this.normalizePath(path);
        const entry = this.entries.get(normalized);
        if (entry?.onDisk) {
            if (entry.kind === "created" || options?.kind === "created") {
                try {
                    await deleteWorkspaceFile(workspaceRoot, normalized);
                }
                catch {
                }
            }
            else {
                await writeWorkspaceFile(workspaceRoot, normalized, options?.previousContent ?? entry.baselineContent ?? "", { historySource: "user" });
            }
        }
        this.entries.delete(normalized);
    }
    async revertAgentChange(workspaceRoot: string, payload: {
        path: string;
        previousContent: string | null;
        kind: "created" | "modified" | "deleted";
    }): Promise<void> {
        const normalized = this.normalizePath(payload.path);
        const entry = this.entries.get(normalized);
        if (entry && !entry.onDisk) {
            this.entries.delete(normalized);
            return;
        }
        if (entry?.onDisk && entry.kind === "deleted") {
            if (entry.baselineContent !== null) {
                await writeWorkspaceFile(workspaceRoot, normalized, entry.baselineContent, { historySource: "user" });
            }
            this.entries.delete(normalized);
            return;
        }
        if (entry?.onDisk) {
            await this.revertPath(workspaceRoot, normalized, {
                previousContent: payload.previousContent,
                kind: payload.kind,
            });
            return;
        }
        try {
            if (payload.kind === "created") {
                await deleteWorkspaceEntry(workspaceRoot, normalized);
            }
            else if (payload.previousContent === null) {
                await deleteWorkspaceEntry(workspaceRoot, normalized);
            }
            else {
                await writeWorkspaceFile(workspaceRoot, normalized, payload.previousContent, { historySource: "user" });
            }
        }
        catch (err) {
            if (!isWorkspaceFsMissingError(err))
                throw err;
        }
        this.entries.delete(normalized);
    }
    acknowledgePath(path: string) {
        this.entries.delete(this.normalizePath(path));
    }
    listPaths(): string[] {
        return [...this.entries.keys()];
    }
}
