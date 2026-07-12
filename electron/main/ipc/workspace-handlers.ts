import { dialog, ipcMain, shell } from "electron";
import { dirname, join, relative, resolve } from "path";
import { stat, mkdir } from "fs/promises";
import { tmpdir } from "os";
import {
    assertWorkspaceRoot,
    createWorkspaceDirectory,
    createWorkspaceFile,
    deleteWorkspaceEntry,
    listWorkspaceDirectory,
    listWorkspaceTree,
    readWorkspaceFile,
    renameWorkspaceEntry,
    writeWorkspaceFile,
    WorkspaceError,
} from "../workspace";
import { restartWorkspaceWatcher } from "../workspace-watcher";
import { lintWorkspaceFile } from "../linter";
import { store } from "../store";
import type { IpcContext } from "./context";
import { fail, ok, pushRecentWorkspace } from "./context";

function currentWorkspace(ctx: IpcContext): string {
    return assertWorkspaceRoot(ctx.getWorkspacePath());
}

function assignWorkspace(ctx: IpcContext, path: string): string[] {
    ctx.setWorkspacePath(path);
    store.set("workspacePath", path);
    const recent = pushRecentWorkspace(path);
    restartWorkspaceWatcher(path);
    return recent;
}

function assertEntryName(name: string, label: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new WorkspaceError(`Укажите ${label}.`);
    }
    if (/[\\/]/.test(trimmed) || trimmed.includes("..")) {
        throw new WorkspaceError(`Некорректное имя: ${trimmed}`);
    }
    return trimmed;
}

export function registerWorkspaceHandlers(ctx: IpcContext): void {
    ipcMain.handle("workspace:lint", async (_e, path: string, content: string) => {
        try {
            const root = ctx.getWorkspacePath().trim() || tmpdir();
            return ok(await lintWorkspaceFile(root, path, content));
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:pick", async () => {
        const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
        if (result.canceled || !result.filePaths[0])
            return { ok: false, error: "cancelled" };
        const recent = assignWorkspace(ctx, result.filePaths[0]);
        return ok({ workspacePath: ctx.getWorkspacePath(), recentWorkspaces: recent });
    });

    ipcMain.handle("workspace:pickFile", async () => {
        const result = await dialog.showOpenDialog({ properties: ["openFile"] });
        if (result.canceled || !result.filePaths[0])
            return { ok: false, error: "cancelled" };
        const filePath = result.filePaths[0];
        const folderPath = dirname(filePath);
        const recent = assignWorkspace(ctx, folderPath);
        const relativePath = relative(folderPath, filePath).replace(/\\/g, "/");
        return ok({ workspacePath: ctx.getWorkspacePath(), recentWorkspaces: recent, filePath: relativePath });
    });

    ipcMain.handle("workspace:pickParentDirectory", async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openDirectory", "createDirectory"],
        });
        if (result.canceled || !result.filePaths[0])
            return { ok: false, error: "cancelled" };
        return ok({ parentPath: result.filePaths[0] });
    });

    ipcMain.handle("workspace:createProjectFolder", async (_e, parentPath: string, name: string) => {
        try {
            const parent = resolve(String(parentPath ?? "").trim());
            if (!parent)
                throw new WorkspaceError("Выберите расположение.");
            const folderName = assertEntryName(name, "имя папки");
            const full = join(parent, folderName);
            const info = await stat(full).catch(() => null);
            if (info?.isFile())
                throw new WorkspaceError("Путь уже занят файлом.");
            if (!info) {
                await mkdir(full, { recursive: true });
            }
            const recent = assignWorkspace(ctx, full);
            return ok({ workspacePath: ctx.getWorkspacePath(), recentWorkspaces: recent });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:createProjectFile", async (_e, parentPath: string, name: string) => {
        try {
            const parent = resolve(String(parentPath ?? "").trim());
            if (!parent)
                throw new WorkspaceError("Выберите расположение.");
            const fileName = assertEntryName(name, "имя файла");
            await stat(parent).catch(() => {
                throw new WorkspaceError("Расположение не найдено.");
            });
            assignWorkspace(ctx, parent);
            const filePath = await createWorkspaceFile(parent, ".", fileName);
            const recent = store.get("recentWorkspaces");
            return ok({
                workspacePath: ctx.getWorkspacePath(),
                recentWorkspaces: recent,
                filePath,
            });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:set", (_e, path: string) => {
        assignWorkspace(ctx, assertWorkspaceRoot(path));
        return ok({ workspacePath: ctx.getWorkspacePath() });
    });

    ipcMain.handle("workspace:list", async (_e, path = ".") => {
        try {
            return ok({ entries: await listWorkspaceDirectory(currentWorkspace(ctx), path) });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:tree", async () => {
        try {
            return ok(await listWorkspaceTree(currentWorkspace(ctx)));
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:read", async (_e, path: string) => {
        try {
            return ok({ content: await readWorkspaceFile(currentWorkspace(ctx), path) });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:write", async (_e, path: string, content: string) => {
        try {
            await writeWorkspaceFile(currentWorkspace(ctx), path, content, { historySource: "user" });
            return ok({});
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:createFile", async (_e, parentPath: string, name: string) => {
        try {
            return ok({ path: await createWorkspaceFile(currentWorkspace(ctx), parentPath, name) });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:createDirectory", async (_e, parentPath: string, name: string) => {
        try {
            return ok({ path: await createWorkspaceDirectory(currentWorkspace(ctx), parentPath, name) });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:rename", async (_e, path: string, newName: string) => {
        try {
            return ok({ path: await renameWorkspaceEntry(currentWorkspace(ctx), path, newName) });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:delete", async (_e, path: string) => {
        try {
            await deleteWorkspaceEntry(currentWorkspace(ctx), path);
            return ok({});
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("workspace:reveal", async (_e, path = ".") => {
        try {
            shell.showItemInFolder(join(currentWorkspace(ctx), path));
            return ok({});
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("shell:openExternal", async (_e, url: string) => {
        try {
            const target = String(url ?? "").trim();
            if (!/^https?:\/\//i.test(target)) {
                return fail(new Error("Разрешены только http(s) ссылки."));
            }
            await shell.openExternal(target);
            return ok({});
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("file:saveAs", async (_e, sourcePath: string) => {
        try {
            const result = await dialog.showSaveDialog({ defaultPath: sourcePath });
            if (result.canceled || !result.filePath)
                return { ok: false, error: "cancelled" };
            const rel = relative(currentWorkspace(ctx), result.filePath).replace(/\\/g, "/");
            return ok({ relativePath: rel });
        }
        catch (err) {
            return fail(err);
        }
    });
}
