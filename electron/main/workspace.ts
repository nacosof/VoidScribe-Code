import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "path";
export class WorkspaceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "WorkspaceError";
    }
}
export type WorkspaceEntry = {
    name: string;
    path: string;
    kind: "file" | "directory";
    size?: number;
    excluded?: boolean;
};
export type WorkspaceTreeNode = {
    name: string;
    path: string;
    kind: "file" | "directory";
    excluded?: boolean;
    children?: WorkspaceTreeNode[];
};
const HIDDEN_ENTRY_NAMES = new Set([".voidscribe-history"]);
const AGENT_SNAPSHOT_SKIP_NAMES = new Set(["node_modules", ".voidscribe-history"]);
export function normalizeAgentRelativePath(input: string): string {
    const normalized = input.replace(/\\/g, "/").replace(/^\.\//, "").trim();
    if (!normalized || normalized === ".")
        return ".";
    if (normalized.includes("\0"))
        throw new WorkspaceError("Некорректный путь.");
    if (normalized.split("/").some((part) => part === "..")) {
        throw new WorkspaceError("Путь не должен выходить за пределы workspace.");
    }
    if (normalized === ".voidscribe-history" ||
        normalized.startsWith(".voidscribe-history/")) {
        throw new WorkspaceError("Путь .voidscribe-history зарезервирован для внутренней истории файлов.");
    }
    return normalized;
}
export function resolveAgentRelativePath(workspaceRoot: string, input: string): string {
    const trimmed = input.trim();
    if (!trimmed)
        throw new WorkspaceError("Укажите путь файла.");
    const root = assertWorkspaceRoot(workspaceRoot);
    const slash = trimmed.replace(/\\/g, "/");
    if (isAbsolute(trimmed) || /^[A-Za-z]:(?:\/|$)/.test(slash)) {
        const full = resolve(trimmed);
        const rel = relative(root, full);
        if (rel.startsWith("..") || isAbsolute(rel)) {
            const hint = basename(full);
            throw new WorkspaceError(`Путь «${trimmed}» вне workspace. Используй относительный путь внутри проекта (например «${hint}»).`);
        }
        return normalizeAgentRelativePath(rel.replace(/\\/g, "/"));
    }
    return normalizeAgentRelativePath(slash);
}
export function assertWorkspaceRoot(workspaceRoot: string): string {
    const root = workspaceRoot.trim();
    if (!root || !isAbsolute(root))
        throw new WorkspaceError("Откройте папку проекта.");
    return resolve(root);
}
export function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
    const root = assertWorkspaceRoot(workspaceRoot);
    const rel = normalizeAgentRelativePath(relativePath || ".");
    const full = resolve(root, rel === "." ? "" : rel);
    const back = relative(root, full);
    if (back.startsWith("..") || isAbsolute(back)) {
        throw new WorkspaceError("Путь выходит за пределы workspace.");
    }
    return full;
}
export function isWorkspaceFsMissingError(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT";
}
export function isWorkspaceFsLockError(err: unknown): boolean {
    const code = typeof err === "object" && err !== null ? (err as NodeJS.ErrnoException).code : "";
    return code === "EBUSY" || code === "EPERM" || code === "EACCES" || code === "ENOTEMPTY";
}
export async function listWorkspaceDirectory(workspaceRoot: string, relativePath = "."): Promise<WorkspaceEntry[]> {
    const dir = resolveWorkspacePath(workspaceRoot, relativePath);
    const entries = await readdir(dir, { withFileTypes: true });
    const out: WorkspaceEntry[] = [];
    for (const entry of entries) {
        if (HIDDEN_ENTRY_NAMES.has(entry.name))
            continue;
        const relBase = normalizeAgentRelativePath(relativePath || ".");
        const path = relBase === "." ? entry.name : `${relBase}/${entry.name}`;
        const full = resolve(dir, entry.name);
        const info = await stat(full).catch(() => null);
        out.push({
            name: entry.name,
            path: path.replace(/\\/g, "/"),
            kind: entry.isDirectory() ? "directory" : "file",
            size: info?.isFile() ? info.size : undefined,
        });
    }
    return out.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "directory" ? -1 : 1);
}
export async function readWorkspaceFile(workspaceRoot: string, relativePath: string): Promise<string> {
    const full = resolveWorkspacePath(workspaceRoot, relativePath);
    const info = await stat(full);
    if (!info.isFile())
        throw new WorkspaceError("Это не файл.");
    if (info.size > 2 * 1024 * 1024)
        throw new WorkspaceError("Файл слишком большой для чтения.");
    return readFile(full, "utf8");
}
export async function readWorkspaceFileIfExists(workspaceRoot: string, relativePath: string): Promise<string | null> {
    try {
        return await readWorkspaceFile(workspaceRoot, relativePath);
    }
    catch (err) {
        if (isWorkspaceFsMissingError(err))
            return null;
        throw err;
    }
}
export async function writeWorkspaceFile(workspaceRoot: string, relativePath: string, content: string, _options?: {
    historySource?: "agent" | "user";
}): Promise<void> {
    const full = resolveWorkspacePath(workspaceRoot, relativePath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
}
export async function deleteWorkspaceFile(workspaceRoot: string, relativePath: string): Promise<void> {
    await rm(resolveWorkspacePath(workspaceRoot, relativePath), { force: true });
}
export async function deleteWorkspaceEntry(workspaceRoot: string, relativePath: string): Promise<void> {
    const rel = normalizeAgentRelativePath(relativePath);
    if (rel === ".")
        throw new WorkspaceError("Нельзя удалить корень проекта.");
    await rm(resolveWorkspacePath(workspaceRoot, rel), { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
function assertEntryName(name: string, label: string): string {
    const trimmed = name.trim();
    if (!trimmed)
        throw new WorkspaceError(`Укажите ${label}.`);
    if (/[\\/]/.test(trimmed) || trimmed.includes("..")) {
        throw new WorkspaceError(`Некорректное имя: ${trimmed}`);
    }
    return trimmed;
}
async function assertPathAvailable(workspaceRoot: string, relativePath: string): Promise<void> {
    try {
        await stat(resolveWorkspacePath(workspaceRoot, relativePath));
        throw new WorkspaceError("Уже существует.");
    }
    catch (err) {
        if (!isWorkspaceFsMissingError(err))
            throw err;
    }
}
export async function createWorkspaceFile(workspaceRoot: string, parentPath: string, name: string): Promise<string> {
    const parent = normalizeAgentRelativePath(parentPath || ".");
    const fileName = assertEntryName(name, "имя файла");
    const rel = parent === "." ? fileName : `${parent}/${fileName}`;
    await assertPathAvailable(workspaceRoot, rel);
    const full = resolveWorkspacePath(workspaceRoot, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, "", "utf8");
    return rel;
}
export async function createWorkspaceDirectory(workspaceRoot: string, parentPath: string, name: string): Promise<string> {
    const parent = normalizeAgentRelativePath(parentPath || ".");
    const dirName = assertEntryName(name, "имя папки");
    const rel = parent === "." ? dirName : `${parent}/${dirName}`;
    await assertPathAvailable(workspaceRoot, rel);
    await mkdir(resolveWorkspacePath(workspaceRoot, rel), { recursive: true });
    return rel;
}
export async function renameWorkspaceEntry(workspaceRoot: string, relativePath: string, newName: string): Promise<string> {
    const from = normalizeAgentRelativePath(relativePath);
    if (from === ".")
        throw new WorkspaceError("Нельзя переименовать корень проекта.");
    const nextName = assertEntryName(newName, "новое имя");
    const parent = dirname(from).replace(/\\/g, "/");
    const to = parent === "." ? nextName : `${parent}/${nextName}`;
    if (to === from)
        return from;
    await assertPathAvailable(workspaceRoot, to);
    await rename(resolveWorkspacePath(workspaceRoot, from), resolveWorkspacePath(workspaceRoot, to));
    return to;
}
async function buildWorkspaceTree(workspaceRoot: string, relativePath = ".", depth = 0, maxDepth = 12): Promise<WorkspaceTreeNode[]> {
    if (depth > maxDepth)
        return [];
    const entries = await listWorkspaceDirectory(workspaceRoot, relativePath);
    const nodes: WorkspaceTreeNode[] = [];
    for (const entry of entries) {
        if (entry.kind === "directory") {
            const children = await buildWorkspaceTree(workspaceRoot, entry.path, depth + 1, maxDepth);
            nodes.push({ name: entry.name, path: entry.path, kind: "directory", children });
        }
        else {
            nodes.push({
                name: entry.name,
                path: entry.path,
                kind: "file",
            });
        }
    }
    return nodes;
}
export async function listWorkspaceTree(workspaceRoot: string): Promise<{
    rootName: string;
    nodes: WorkspaceTreeNode[];
}> {
    const root = assertWorkspaceRoot(workspaceRoot);
    return {
        rootName: basename(root),
        nodes: await buildWorkspaceTree(root, "."),
    };
}
async function walk(root: string, rel: string, out: string[], limit: number): Promise<void> {
    if (out.length >= limit)
        return;
    let entries: WorkspaceEntry[] = [];
    try {
        entries = await listWorkspaceDirectory(root, rel);
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (out.length >= limit)
            return;
        if (entry.kind === "directory" && AGENT_SNAPSHOT_SKIP_NAMES.has(entry.name)) {
            out.push(`📁 ${entry.path} (skipped)`);
            continue;
        }
        out.push(`${entry.kind === "directory" ? "📁" : "📄"} ${entry.path}`);
        if (entry.kind === "directory")
            await walk(root, entry.path, out, limit);
    }
}
export async function snapshotWorkspaceTextFiles(workspaceRoot: string, maxEntries = 120): Promise<string> {
    const lines: string[] = [];
    await walk(workspaceRoot, ".", lines, maxEntries);
    return lines.length ? lines.join("\n") : "(empty workspace)";
}
export async function diffWorkspaceTextSnapshots(workspaceRoot: string, paths: string[]): Promise<string> {
    const chunks: string[] = [];
    for (const path of paths) {
        const content = await readWorkspaceFileIfExists(workspaceRoot, path);
        chunks.push(`--- ${path} ---\n${content ?? "(missing)"}`);
    }
    return chunks.join("\n\n");
}
