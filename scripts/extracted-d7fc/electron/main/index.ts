import { app, BrowserWindow, dialog, ipcMain, nativeImage } from "electron";
import { join } from "path";
import { streamChatCompletion } from "./ai";
import { settingsStore, toPublicSettings } from "./store";
import type { AppSettings, ChatMessage } from "../../src/types";
import {
  getUserAiProviderConfig,
  isUserAiProviderId,
} from "../../src/lib/providers";

const isDev = !app.isPackaged;

function getIconPath(): string {
  return join(__dirname, "../../resources/icon.png");
}

function createWindow(): BrowserWindow {
  const icon = nativeImage.createFromPath(getIconPath());

  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: "VoidScribe Code",
    backgroundColor: "#030408",
    icon: icon.isEmpty() ? undefined : icon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL!);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

function registerIpc(win: BrowserWindow): void {
  ipcMain.handle("settings:get", () => {
    return toPublicSettings(settingsStore.store);
  });

  ipcMain.handle("settings:save", (_event, patch: Partial<AppSettings>) => {
    const current = settingsStore.store;

    if (patch.provider && isUserAiProviderId(patch.provider)) {
      current.provider = patch.provider;
      if (!patch.model) {
        current.model = getUserAiProviderConfig(patch.provider).defaultModel;
      }
    }

    if (typeof patch.apiKey === "string") {
      current.apiKey = patch.apiKey;
    }

    if (typeof patch.model === "string" && patch.model.trim()) {
      current.model = patch.model.trim();
    }

    if (typeof patch.workspacePath === "string") {
      current.workspacePath = patch.workspacePath;
    }

    if (typeof patch.systemPrompt === "string") {
      current.systemPrompt = patch.systemPrompt;
    }

    settingsStore.store = current;
    return toPublicSettings(current);
  });

  ipcMain.handle("dialog:selectWorkspace", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Выберите папку проекта",
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const path = result.filePaths[0]!;
    settingsStore.set("workspacePath", path);
    return path;
  });

  ipcMain.handle(
    "chat:send",
    async (_event, payload: { messages: ChatMessage[]; requestId: string }) => {
      void streamChatCompletion({
        settings: settingsStore.store,
        history: payload.messages,
        requestId: payload.requestId,
        window: win,
      });
      return { ok: true };
    }
  );
}

app.whenReady().then(() => {
  const win = createWindow();
  registerIpc(win);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const next = createWindow();
      registerIpc(next);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
