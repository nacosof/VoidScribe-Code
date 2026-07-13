import { app, BrowserWindow, nativeImage } from "electron";
process.noDeprecation = true;
import { existsSync } from "fs";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { bindPtyWindow } from "./pty-manager";
import { restartWorkspaceWatcher, stopWorkspaceWatcher } from "./workspace-watcher";
import { store } from "./store";
import { registerAllIpcHandlers } from "./ipc";
import { setupMacAppMenu, refreshMacAppMenu } from "./app-menu";

const APP_NAME = "VoidScribe Code";

if (process.platform === "darwin") {
    app.setName(APP_NAME);
    app.setAboutPanelOptions({
        applicationName: APP_NAME,
        applicationVersion: app.getVersion(),
    });
}

let mainWindow: BrowserWindow | null = null;
let workspacePath = store.get("workspacePath") || "";

const MIN_ZOOM_LEVEL = -2;
const MAX_ZOOM_LEVEL = 3;

function clampZoomLevel(level: number): number {
    return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, Math.round(level)));
}

function resolveAppIcon(): Electron.NativeImage {
    const candidates = [
        join(__dirname, "../../public/logo.png"),
        join(process.cwd(), "public/logo.png"),
    ];
    for (const candidate of candidates) {
        if (!existsSync(candidate))
            continue;
        const image = nativeImage.createFromPath(candidate);
        if (!image.isEmpty())
            return image;
    }
    return nativeImage.createEmpty();
}

function applyZoomLevel(level: number): number {
    if (!mainWindow)
        return 0;
    const next = clampZoomLevel(level);
    mainWindow.webContents.setZoomLevel(next);
    return next;
}

function send(channel: string, payload: unknown): void {
    mainWindow?.webContents.send(channel, payload);
}

function preloadScriptPath(): string {
    const dir = join(__dirname, "../preload");
    const mjs = join(dir, "index.mjs");
    const js = join(dir, "index.js");
    if (existsSync(mjs))
        return mjs;
    if (existsSync(js))
        return js;
    return js;
}

function createWindow(): void {
    const icon = resolveAppIcon();
    const isMac = process.platform === "darwin";
    mainWindow = new BrowserWindow({
        width: 1360,
        height: 860,
        minWidth: 940,
        minHeight: 640,
        ...(isMac
            ? {
                titleBarStyle: "hiddenInset",
                trafficLightPosition: { x: 14, y: 12 },
            }
            : {
                frame: false,
            }),
        title: APP_NAME,
        backgroundColor: "#030408",
        icon: icon.isEmpty() ? undefined : icon,
        show: false,
        webPreferences: {
            preload: preloadScriptPath(),
            sandbox: false,
            contextIsolation: true,
        },
    });
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
        if (isMac)
            refreshMacAppMenu();
    });
    bindPtyWindow(mainWindow);
    mainWindow.on("maximize", () => send("window:maximized", true));
    mainWindow.on("unmaximize", () => send("window:maximized", false));
    mainWindow.on("enter-full-screen", () => {
        send("window:fullscreen", true);
        refreshMacAppMenu();
    });
    mainWindow.on("leave-full-screen", () => {
        send("window:fullscreen", false);
        refreshMacAppMenu();
    });
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    }
    else {
        mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
    }
    if (workspacePath)
        restartWorkspaceWatcher(workspacePath);
    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown")
            return;
        if (!(input.control || input.meta))
            return;
        if (input.alt)
            return;
        const zoomIn = input.code === "Equal" ||
            input.code === "NumpadAdd" ||
            input.key === "=" ||
            input.key === "+";
        const zoomOut = input.code === "Minus" ||
            input.code === "NumpadSubtract" ||
            input.key === "-" ||
            input.key === "_";
        const zoomReset = input.code === "Digit0" || input.code === "Numpad0" || input.key === "0";
        if (!zoomIn && !zoomOut && !zoomReset)
            return;
        event.preventDefault();
        const current = mainWindow?.webContents.getZoomLevel() ?? 0;
        if (zoomReset)
            applyZoomLevel(0);
        else if (zoomIn)
            applyZoomLevel(current + 1);
        else if (zoomOut)
            applyZoomLevel(current - 1);
    });
}

app.whenReady().then(() => {
    if (process.platform === "win32") {
        app.setAppUserModelId("com.voidscribe.code");
    }
    if (process.platform === "darwin") {
        app.setName(APP_NAME);
    }
    const icon = resolveAppIcon();
    if (!icon.isEmpty()) {
        app.dock?.setIcon(icon);
    }
    registerAllIpcHandlers({
        getMainWindow: () => mainWindow,
        getWorkspacePath: () => workspacePath,
        setWorkspacePath: (path) => {
            workspacePath = path;
        },
        send,
        applyZoomLevel,
    });
    setupMacAppMenu({
        getMainWindow: () => mainWindow,
        getWorkspacePath: () => workspacePath,
        setWorkspacePath: (path) => {
            workspacePath = path;
        },
        send,
        applyZoomLevel,
    });
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
app.on("before-quit", stopWorkspaceWatcher);
app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        app.quit();
});
process.on("uncaughtException", (err) => console.error(err));
process.on("unhandledRejection", (err) => console.error(err));
