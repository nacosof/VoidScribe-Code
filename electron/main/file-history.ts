import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { join } from "path";
import { assertWorkspaceRoot } from "./workspace";
type VersionRecord = {
    id: string;
    path: string;
    createdAt: number;
    content: string;
    source: "agent" | "user";
};
const historyDir = ".voidscribe-history";
function historyRoot(workspaceRoot: string): string {
    return join(assertWorkspaceRoot(workspaceRoot), historyDir);
}
function historyFilePath(workspaceRoot: string, id: string): string {
    return join(historyRoot(workspaceRoot), `${id}.json`);
}
function versionId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
export async function recordFileSnapshot(workspaceRoot: string, path: string, content: string, source: "agent" | "user" = "agent"): Promise<string> {
    const id = versionId();
    const record: VersionRecord = { id, path, createdAt: Date.now(), content, source };
    const full = historyFilePath(workspaceRoot, id);
    await mkdir(historyRoot(workspaceRoot), { recursive: true });
    await writeFile(full, JSON.stringify(record), "utf8");
    return id;
}
export async function listFileHistory(workspaceRoot: string, path?: string): Promise<VersionRecord[]> {
    const dir = historyRoot(workspaceRoot);
    try {
        await stat(dir);
    }
    catch {
        return [];
    }
    const files = await readdir(dir);
    const records: VersionRecord[] = [];
    for (const file of files.filter((item) => item.endsWith(".json"))) {
        try {
            const record = JSON.parse(await readFile(join(dir, file), "utf8")) as VersionRecord;
            if (!path || record.path === path)
                records.push(record);
        }
        catch { }
    }
    return records.sort((a, b) => b.createdAt - a.createdAt);
}
export async function readFileHistoryVersion(workspaceRoot: string, id: string): Promise<VersionRecord | null> {
    try {
        return JSON.parse(await readFile(historyFilePath(workspaceRoot, id), "utf8")) as VersionRecord;
    }
    catch {
        return null;
    }
}
