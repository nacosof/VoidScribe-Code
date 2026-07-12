import { watch, type FSWatcher } from "fs";
import { BrowserWindow } from "electron";
import { assertWorkspaceRoot } from "./workspace";
const IGNORE_DIR_SEGMENTS = new Set([
    "node_modules",
    ".git",
    ".next",
    ".turbo",
    "dist",
    "build",
    ".cache",
    ".venv",
    "__pycache__",
]);
function shouldIgnoreWatchPath(filename: string): boolean {
    const normalized = filename.replace(/\\/g, "/");
    return normalized
        .split("/")
        .some((part) => part && IGNORE_DIR_SEGMENTS.has(part));
}
function notifyAllWindows(): void {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send("workspace:changed");
        }
    }
}
let activeWatcher: FSWatcher | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleNotify(): void {
    if (debounceTimer)
        clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        notifyAllWindows();
    }, 400);
}
export function stopWorkspaceWatcher(): void {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (activeWatcher) {
        try {
            activeWatcher.close();
        }
        catch {
        }
        activeWatcher = null;
    }
}
export function restartWorkspaceWatcher(workspacePath: string): void {
    stopWorkspaceWatcher();
    const trimmed = workspacePath.trim();
    if (!trimmed)
        return;
    let root: string;
    try {
        root = assertWorkspaceRoot(trimmed);
    }
    catch {
        return;
    }
    const recursive = process.platform === "win32" || process.platform === "darwin";
    try {
        activeWatcher = watch(root, { recursive }, (_event, filename) => {
            if (filename && shouldIgnoreWatchPath(filename))
                return;
            scheduleNotify();
        });
        activeWatcher.on("error", () => {
            if (pollTimer)
                return;
            pollTimer = setInterval(scheduleNotify, 4000);
        });
    }
    catch {
        pollTimer = setInterval(scheduleNotify, 4000);
    }
    if (!recursive && !pollTimer) {
        pollTimer = setInterval(scheduleNotify, 4000);
    }
}
