import { basename, dirname, relative } from "path";
import { dialog, Menu, type MenuItemConstructorOptions } from "electron";
import { getSettings, store } from "./store";
import type { IpcContext } from "./ipc/context";
import { assignWorkspaceSession, notifyWorkspaceOpened } from "./workspace-session";

const APP_NAME = "VoidScribe Code";

type MenuLang = "en" | "ru";

const LABELS: Record<MenuLang, {
    file: string;
    openFolder: string;
    openFile: string;
    openRecent: string;
    noRecent: string;
    closeWindow: string;
}> = {
    en: {
        file: "File",
        openFolder: "Open Folder…",
        openFile: "Open File…",
        openRecent: "Open Recent",
        noRecent: "No Recent Folders",
        closeWindow: "Close Window",
    },
    ru: {
        file: "Файл",
        openFolder: "Открыть папку…",
        openFile: "Открыть файл…",
        openRecent: "Открыть недавнее",
        noRecent: "Нет недавних папок",
        closeWindow: "Закрыть окно",
    },
};

let menuCtx: IpcContext | null = null;

function menuLang(): MenuLang {
    const lang = getSettings().language;
    return lang === "ru" ? "ru" : "en";
}

function labels() {
    return LABELS[menuLang()];
}

async function openFolder(ctx: IpcContext): Promise<void> {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths[0])
        return;
    const recent = assignWorkspaceSession(ctx, result.filePaths[0]);
    notifyWorkspaceOpened(ctx, {
        workspacePath: ctx.getWorkspacePath(),
        recentWorkspaces: recent,
    });
    refreshMacAppMenu();
}

async function openFile(ctx: IpcContext): Promise<void> {
    const result = await dialog.showOpenDialog({ properties: ["openFile"] });
    if (result.canceled || !result.filePaths[0])
        return;
    const filePath = result.filePaths[0];
    const folderPath = dirname(filePath);
    const recent = assignWorkspaceSession(ctx, folderPath);
    notifyWorkspaceOpened(ctx, {
        workspacePath: ctx.getWorkspacePath(),
        recentWorkspaces: recent,
        filePath: relative(folderPath, filePath).replace(/\\/g, "/"),
    });
    refreshMacAppMenu();
}

async function openRecent(ctx: IpcContext, path: string): Promise<void> {
    const recent = assignWorkspaceSession(ctx, path);
    notifyWorkspaceOpened(ctx, {
        workspacePath: ctx.getWorkspacePath(),
        recentWorkspaces: recent,
    });
    refreshMacAppMenu();
}

function buildFileSubmenu(ctx: IpcContext): MenuItemConstructorOptions[] {
    const text = labels();
    const recent = store.get("recentWorkspaces") ?? [];
    const recentSubmenu: MenuItemConstructorOptions[] = recent.length
        ? recent.map((path) => ({
            label: basename(path) || path,
            click: () => void openRecent(ctx, path),
        }))
        : [{ label: text.noRecent, enabled: false }];
    return [
        {
            label: text.openFolder,
            accelerator: "Cmd+Ctrl+O",
            click: () => void openFolder(ctx),
        },
        {
            label: text.openFile,
            accelerator: "Cmd+O",
            click: () => void openFile(ctx),
        },
        { type: "separator" },
        {
            label: text.openRecent,
            submenu: recentSubmenu,
        },
        { type: "separator" },
        {
            label: text.closeWindow,
            accelerator: "Cmd+W",
            role: "close",
        },
    ];
}

export function refreshMacAppMenu(): void {
    if (process.platform !== "darwin" || !menuCtx)
        return;
    const ctx = menuCtx;
    const text = labels();
    const template: MenuItemConstructorOptions[] = [
        {
            label: APP_NAME,
            submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        },
        {
            label: text.file,
            submenu: buildFileSubmenu(ctx),
        },
        { role: "editMenu" },
        { role: "viewMenu" },
        { role: "windowMenu" },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function setupMacAppMenu(ctx: IpcContext): void {
    if (process.platform !== "darwin")
        return;
    menuCtx = ctx;
    refreshMacAppMenu();
}
