import { ipcMain } from "electron";
import type { IpcContext } from "./context";
import { ok } from "./context";

export function registerWindowHandlers(ctx: IpcContext): void {
    ipcMain.handle("window:minimize", () => {
        ctx.getMainWindow()?.minimize();
        return ok({});
    });

    ipcMain.handle("window:toggleMaximize", () => {
        const mainWindow = ctx.getMainWindow();
        if (!mainWindow)
            return ok({ maximized: false });
        if (mainWindow.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow.maximize();
        return ok({ maximized: mainWindow.isMaximized() });
    });

    ipcMain.handle("window:close", () => {
        ctx.getMainWindow()?.close();
        return ok({});
    });

    ipcMain.handle("window:isMaximized", () => ctx.getMainWindow()?.isMaximized() ?? false);

    ipcMain.handle("window:getZoom", () => ok({ level: ctx.getMainWindow()?.webContents.getZoomLevel() ?? 0 }));

    ipcMain.handle("window:adjustZoom", (_e, delta: number) => {
        const current = ctx.getMainWindow()?.webContents.getZoomLevel() ?? 0;
        return ok({ level: ctx.applyZoomLevel(current + (Number(delta) || 0)) });
    });

    ipcMain.handle("window:resetZoom", () => ok({ level: ctx.applyZoomLevel(0) }));
}
