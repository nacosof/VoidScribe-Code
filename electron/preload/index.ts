import { contextBridge, ipcRenderer } from "electron";
import type { VoidScribeApi } from "../../src/types";
const isWin = process.platform === "win32";
const api: VoidScribeApi = {
    getAppState: () => ipcRenderer.invoke("settings:get"),
    saveSettings: (patch) => ipcRenderer.invoke("settings:save", patch),
    completeOnboarding: () => ipcRenderer.invoke("onboarding:complete"),
    saveChatState: (state) => ipcRenderer.invoke("chat:save", state),
    discoverLocalProviders: (input) => ipcRenderer.invoke("ai:discoverLocal", input),
    listProviderModels: (input) => ipcRenderer.invoke("ai:listModels", input),
    lintWorkspaceFile: (path, content, options) => ipcRenderer.invoke("workspace:lint", path, content, options),
    pickWorkspace: () => ipcRenderer.invoke("workspace:pick"),
    pickWorkspaceFile: () => ipcRenderer.invoke("workspace:pickFile"),
    pickParentDirectory: () => ipcRenderer.invoke("workspace:pickParentDirectory"),
    createProjectFolder: (parentPath, name) => ipcRenderer.invoke("workspace:createProjectFolder", parentPath, name),
    createProjectFile: (parentPath, name) => ipcRenderer.invoke("workspace:createProjectFile", parentPath, name),
    setWorkspacePath: (path) => ipcRenderer.invoke("workspace:set", path),
    listWorkspaceDirectory: (path) => ipcRenderer.invoke("workspace:list", path),
    listWorkspaceTree: () => ipcRenderer.invoke("workspace:tree"),
    readWorkspaceFile: (path) => ipcRenderer.invoke("workspace:read", path),
    writeWorkspaceFile: (path, content) => ipcRenderer.invoke("workspace:write", path, content),
    createWorkspaceFile: (parentPath, name) => ipcRenderer.invoke("workspace:createFile", parentPath, name),
    createWorkspaceDirectory: (parentPath, name) => ipcRenderer.invoke("workspace:createDirectory", parentPath, name),
    renameWorkspaceEntry: (path, newName) => ipcRenderer.invoke("workspace:rename", path, newName),
    deleteWorkspaceEntry: (path) => ipcRenderer.invoke("workspace:delete", path),
    revealWorkspacePath: (path) => ipcRenderer.invoke("workspace:reveal", path),
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
    pickSaveFileAs: (sourcePath) => ipcRenderer.invoke("file:saveAs", sourcePath),
    runWorkspaceCommand: (command, cwd) => ipcRenderer.invoke("terminal:run", command, cwd),
    streamChat: (input) => ipcRenderer.invoke("chat:stream", input),
    cancelChat: (requestId) => ipcRenderer.invoke("chat:cancel", requestId),
    interruptAgent: () => ipcRenderer.invoke("agent:interrupt"),
    flushAgentStagedFiles: (paths) => ipcRenderer.invoke("agent:flushStaged", paths),
    restoreChatCheckpoint: (checkpoint) => ipcRenderer.invoke("chat:restoreCheckpoint", checkpoint),
    listMcpServers: () => ipcRenderer.invoke("mcp:listServers"),
    terminalList: async () => {
        const result = await ipcRenderer.invoke("terminal:list");
        if (!result.ok)
            return { sessions: [], activeId: null };
        return { sessions: result.sessions, activeId: result.activeId };
    },
    terminalCreate: (cwd) => ipcRenderer.invoke("terminal:create", cwd),
    terminalSelect: async (sessionId) => {
        const result = await ipcRenderer.invoke("terminal:select", sessionId);
        return Boolean(result.ok && result.selected);
    },
    terminalWrite: (sessionId, data) => ipcRenderer.invoke("terminal:write", { sessionId, data }),
    terminalResize: (sessionId, cols, rows) => ipcRenderer.invoke("terminal:resize", { sessionId, cols, rows }),
    terminalKill: async (sessionId) => {
        const result = await ipcRenderer.invoke("terminal:kill", sessionId);
        if (!result.ok)
            return { sessions: [], activeId: null };
        return { sessions: result.sessions, activeId: result.activeId };
    },
    terminalEnsureAgentMirror: async () => {
        const result = await ipcRenderer.invoke("terminal:ensureAgentMirror");
        if (!result.ok)
            return { sessions: [], activeId: null };
        return {
            sessions: result.sessions,
            activeId: result.activeId,
            session: result.session,
        };
    },
    windowMinimize: () => ipcRenderer.invoke("window:minimize"),
    windowToggleMaximize: () => ipcRenderer.invoke("window:toggleMaximize"),
    windowClose: () => ipcRenderer.invoke("window:close"),
    windowIsMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    windowIsFullScreen: () => ipcRenderer.invoke("window:isFullScreen"),
    onWindowMaximized: (callback) => {
        const listener = (_: unknown, maximized: boolean) => callback(maximized);
        ipcRenderer.on("window:maximized", listener);
        return () => ipcRenderer.removeListener("window:maximized", listener);
    },
    onWindowFullScreen: (callback) => {
        const listener = (_: unknown, fullScreen: boolean) => callback(fullScreen);
        ipcRenderer.on("window:fullscreen", listener);
        return () => ipcRenderer.removeListener("window:fullscreen", listener);
    },
    hasCustomTitleBar: isWin,
    hasMacTrafficLights: process.platform === "darwin",
    onWorkspaceOpened: (callback) => {
        const listener = (_: unknown, payload: {
            workspacePath: string;
            recentWorkspaces: string[];
            filePath?: string;
        }) => callback(payload);
        ipcRenderer.on("workspace:opened", listener);
        return () => ipcRenderer.removeListener("workspace:opened", listener);
    },
    onWorkspaceChanged: (callback) => {
        const listener = () => callback();
        ipcRenderer.on("workspace:changed", listener);
        return () => ipcRenderer.removeListener("workspace:changed", listener);
    },
    onChatDelta: (callback) => {
        const listener = (_: unknown, payload: {
            requestId: string;
            delta: string;
        }) => callback(payload);
        ipcRenderer.on("chat:delta", listener);
        return () => ipcRenderer.removeListener("chat:delta", listener);
    },
    onChatDone: (callback) => {
        const listener = (_: unknown, payload: {
            requestId: string;
        }) => callback(payload);
        ipcRenderer.on("chat:done", listener);
        return () => ipcRenderer.removeListener("chat:done", listener);
    },
    onChatError: (callback) => {
        const listener = (_: unknown, payload: {
            requestId: string;
            error: string;
        }) => callback(payload);
        ipcRenderer.on("chat:error", listener);
        return () => ipcRenderer.removeListener("chat:error", listener);
    },
    onAgentEvent: (callback) => {
        const listener = (_: unknown, payload: {
            requestId: string;
            event: unknown;
        }) => callback(payload as Parameters<VoidScribeApi["onAgentEvent"]>[0] extends (p: infer P) => void ? P : never);
        ipcRenderer.on("agent:event", listener);
        return () => ipcRenderer.removeListener("agent:event", listener);
    },
    onAgentTranscript: (callback) => {
        const listener = (_: unknown, payload: {
            requestId: string;
            turns: unknown;
        }) => callback(payload as Parameters<VoidScribeApi["onAgentTranscript"]>[0] extends (p: infer P) => void ? P : never);
        ipcRenderer.on("agent:transcript", listener);
        return () => ipcRenderer.removeListener("agent:transcript", listener);
    },
    onTerminalData: (callback) => {
        const listener = (_: unknown, payload: {
            sessionId: string;
            data: string;
        }) => callback(payload);
        ipcRenderer.on("terminal:data", listener);
        return () => ipcRenderer.removeListener("terminal:data", listener);
    },
    onTerminalUpdated: (callback) => {
        const listener = (_: unknown, payload: {
            sessions: unknown[];
            activeId: string | null;
        }) => callback(payload as Parameters<VoidScribeApi["onTerminalUpdated"]>[0] extends (p: infer P) => void ? P : never);
        ipcRenderer.on("terminal:updated", listener);
        return () => ipcRenderer.removeListener("terminal:updated", listener);
    },
    onTerminalExit: (callback) => {
        const listener = (_: unknown, payload: {
            sessionId: string;
            exitCode: number;
        }) => callback(payload);
        ipcRenderer.on("terminal:exit", listener);
        return () => ipcRenderer.removeListener("terminal:exit", listener);
    },
};
contextBridge.exposeInMainWorld("voidscribe", api);
