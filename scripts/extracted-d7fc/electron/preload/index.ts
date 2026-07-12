import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  ChatMessage,
  StreamChunk,
  TerminalCreateResponse,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalListResponse,
} from "../../src/types";

const isWin = process.platform === "win32";

const voidscribe = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (input: Partial<AppSettings>) =>
    ipcRenderer.invoke("settings:save", input),
  selectWorkspace: () => ipcRenderer.invoke("dialog:selectWorkspace"),
  sendMessage: (messages: ChatMessage[], requestId: string) =>
    ipcRenderer.invoke("chat:send", { messages, requestId }),
  terminalList: () =>
    ipcRenderer.invoke("terminal:list") as Promise<TerminalListResponse>,
  terminalCreate: (cwd: string) =>
    ipcRenderer.invoke("terminal:create", cwd) as Promise<TerminalCreateResponse>,
  terminalSelect: (sessionId: string) =>
    ipcRenderer.invoke("terminal:select", sessionId) as Promise<boolean>,
  terminalWrite: (sessionId: string, data: string) =>
    ipcRenderer.invoke("terminal:write", { sessionId, data }),
  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke("terminal:resize", { sessionId, cols, rows }),
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: TerminalDataEvent
    ) => {
      callback(payload);
    };
    ipcRenderer.on("terminal:data", listener);
    return () => ipcRenderer.removeListener("terminal:data", listener);
  },
  onTerminalExit: (callback: (event: TerminalExitEvent) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: TerminalExitEvent
    ) => {
      callback(payload);
    };
    ipcRenderer.on("terminal:exit", listener);
    return () => ipcRenderer.removeListener("terminal:exit", listener);
  },
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, chunk: StreamChunk) => {
      callback(chunk);
    };
    ipcRenderer.on("chat:stream", listener);
    return () => ipcRenderer.removeListener("chat:stream", listener);
  },
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowToggleMaximize: () => ipcRenderer.invoke("window:toggleMaximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  windowIsMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onWindowMaximized: (callback: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => {
      callback(maximized);
    };
    ipcRenderer.on("window:maximized", listener);
    return () => ipcRenderer.removeListener("window:maximized", listener);
  },
  hasCustomTitleBar: isWin,
};

contextBridge.exposeInMainWorld("voidscribe", voidscribe);
