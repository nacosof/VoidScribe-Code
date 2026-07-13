import type { AgentTranscriptTurn } from "./lib/agent-transcript";
import type { ChatInteractionMode } from "./lib/chat-modes";
import type { AgentPreset } from "./lib/agent-presets";
import type { UserAiProviderId } from "./lib/providers";
export type UiLanguage = "en" | "ru";
export type UiTheme = "voidscribe" | "slate" | "ocean";
export type WindowLayout = "editor" | "agent";
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
export type ChatImage = {
    id: string;
    name: string;
    dataUrl: string;
    mediaType: string;
};
export type AgentEditorContext = {
    activePath?: string | null;
    openPaths?: string[];
};
export type ChatContextRef = {
    kind: "file" | "directory";
    path: string;
    name: string;
};
export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
    mode?: ChatInteractionMode;
    images?: ChatImage[];
    contextRefs?: ChatContextRef[];
    agentActivities?: AgentActivity[];
    agentTranscript?: AgentTranscriptTurn[];
    contentSplitIndex?: number;
    activitySplitIndex?: number;
};
export type ChatCheckpointFile = {
    before: string | null;
    after: string | null;
};
export type ChatCheckpoint = {
    id: string;
    messageId: string;
    activityAt: number;
    label: string;
    files: Record<string, ChatCheckpointFile>;
};
export type ChatSession = {
    id: string;
    title: string;
    messages: ChatMessage[];
    checkpoints?: ChatCheckpoint[];
    createdAt: number;
    updatedAt: number;
};
export type AgentActivity = {
    type: string;
    name?: string;
    detail?: string;
    path?: string;
    kind?: string;
    text?: string;
    stream?: "stdout" | "stderr" | "system";
    command?: string;
    failed?: boolean;
    error?: string;
    checkpointId?: string;
    at: number;
};
export type PendingFileChange = {
    id: string;
    path: string;
    kind: "created" | "modified" | "deleted";
    previousContent: string | null;
    newContent: string;
    workspacePath?: string;
};
export type AiSettings = {
    activePresetId: string;
    presets: AgentPreset[];
    provider: UserAiProviderId;
    model: string;
    apiKey: string;
    baseUrl?: string;
    maxOutputTokens?: number;
    maxAgentSteps?: number;
    language?: UiLanguage;
    theme?: UiTheme;
    windowLayout?: WindowLayout;
    defaultChatMode?: ChatInteractionMode;
};
export type SettingsSavePatch = Partial<AiSettings> & {
    addAgent?: {
        name: string;
        provider: UserAiProviderId;
        model: string;
        apiKey: string;
        baseUrl?: string;
    };
    updatePreset?: {
        presetId: string;
        name?: string;
        maxOutputTokens?: number;
        maxAgentSteps?: number;
    };
    deletePresetId?: string;
};
export type ApiResult<T = Record<string, never>> = ({
    ok: true;
} & T) | {
    ok: false;
    error: string;
};
export type PtySessionInfo = {
    id: string;
    title: string;
    cwd: string;
    alive: boolean;
    mirror?: boolean;
};
export type TerminalListResponse = {
    sessions: PtySessionInfo[];
    activeId: string | null;
};
export type LintSeverity = "error" | "warning" | "info" | "hint";
export type LintDiagnostic = {
    line: number;
    column: number;
    endColumn: number;
    severity: LintSeverity;
    message: string;
};
export type TerminalCreateResponse = {
    ok: true;
    session: PtySessionInfo;
} | {
    ok: false;
    error: string;
};
export type LocalProviderStatus = {
    provider: "ollama" | "lmstudio";
    online: boolean;
    baseUrl: string;
    models: string[];
    error?: string;
};
export type VoidScribeApi = {
    getAppState(): Promise<ApiResult<{
        settings: AiSettings;
        workspacePath: string;
        recentWorkspaces: string[];
        localDiscovery?: LocalProviderStatus[];
        chatState?: {
            sessions: ChatSession[];
            activeId: string;
        } | null;
        onboardingCompleted?: boolean;
    }>>;
    completeOnboarding(): Promise<ApiResult>;
    saveSettings(patch: SettingsSavePatch): Promise<ApiResult<{
        settings: AiSettings;
    }>>;
    saveChatState(state: {
        sessions: ChatSession[];
        activeId: string;
    }): Promise<ApiResult>;
    discoverLocalProviders(input?: {
        ollamaBaseUrl?: string;
        lmstudioBaseUrl?: string;
    }): Promise<ApiResult<{
        discovery: LocalProviderStatus[];
    }>>;
    listProviderModels(input?: {
        provider?: UserAiProviderId;
        apiKey?: string;
        baseUrl?: string;
    }): Promise<ApiResult<{
        models: string[];
    }>>;
    lintWorkspaceFile(path: string, content: string, options?: {
        semantic?: boolean;
    }): Promise<ApiResult<{
        diagnostics: LintDiagnostic[];
    }>>;
    pickWorkspace(): Promise<ApiResult<{
        workspacePath: string;
        recentWorkspaces: string[];
    }>>;
    pickWorkspaceFile(): Promise<ApiResult<{
        workspacePath: string;
        recentWorkspaces: string[];
        filePath: string;
    }>>;
    pickChatAttachment(): Promise<ApiResult<{
        filePath: string;
    }>>;
    pickParentDirectory(): Promise<ApiResult<{
        parentPath: string;
    }>>;
    createProjectFolder(parentPath: string, name: string): Promise<ApiResult<{
        workspacePath: string;
        recentWorkspaces: string[];
    }>>;
    createProjectFile(parentPath: string, name: string): Promise<ApiResult<{
        workspacePath: string;
        recentWorkspaces: string[];
        filePath: string;
    }>>;
    setWorkspacePath(path: string): Promise<ApiResult<{
        workspacePath: string;
    }>>;
    listWorkspaceDirectory(path?: string): Promise<ApiResult<{
        entries: WorkspaceEntry[];
    }>>;
    listWorkspaceTree(): Promise<ApiResult<{
        rootName: string;
        nodes: WorkspaceTreeNode[];
    }>>;
    readWorkspaceFile(path: string): Promise<ApiResult<{
        content: string;
    }>>;
    writeWorkspaceFile(path: string, content: string): Promise<ApiResult>;
    createWorkspaceFile(parentPath: string, name: string): Promise<ApiResult<{
        path: string;
    }>>;
    createWorkspaceDirectory(parentPath: string, name: string): Promise<ApiResult<{
        path: string;
    }>>;
    renameWorkspaceEntry(path: string, newName: string): Promise<ApiResult<{
        path: string;
    }>>;
    deleteWorkspaceEntry(path: string): Promise<ApiResult>;
    revealWorkspacePath(path?: string): Promise<ApiResult>;
    openExternal(url: string): Promise<ApiResult>;
    pickSaveFileAs(sourcePath: string): Promise<ApiResult<{
        relativePath: string;
    }>>;
    runWorkspaceCommand(command: string, cwd?: string): Promise<ApiResult<{
        result: {
            stdout: string;
            stderr: string;
            exitCode: number | null;
            cwd: string;
        };
    }>>;
    streamChat(input: {
        requestId: string;
        messages: ChatMessage[];
        mode?: ChatInteractionMode;
        editorContext?: AgentEditorContext;
    }): Promise<ApiResult>;
    cancelChat(requestId: string): Promise<ApiResult<{
        cancelled: boolean;
    }>>;
    interruptAgent(): Promise<ApiResult<{
        cancelled: string[];
    }>>;
    flushAgentStagedFiles(paths?: string[]): Promise<ApiResult<{
        flushed: string[];
    }>>;
    restoreChatCheckpoint(checkpoint: ChatCheckpoint): Promise<ApiResult<{
        restored: string[];
    }>>;
    listMcpServers(): Promise<ApiResult<{
        servers: Array<{
            name: string;
            toolCount: number;
            disabled: boolean;
        }>;
    }>>;
    terminalList(): Promise<TerminalListResponse>;
    terminalCreate(cwd: string): Promise<TerminalCreateResponse>;
    terminalSelect(sessionId: string): Promise<boolean>;
    terminalWrite(sessionId: string, data: string): Promise<ApiResult>;
    terminalResize(sessionId: string, cols: number, rows: number): Promise<ApiResult>;
    terminalKill(sessionId: string): Promise<TerminalListResponse>;
    terminalEnsureAgentMirror(): Promise<TerminalListResponse & {
        session?: PtySessionInfo;
    }>;
    onTerminalData(callback: (payload: {
        sessionId: string;
        data: string;
    }) => void): () => void;
    onTerminalUpdated(callback: (payload: TerminalListResponse) => void): () => void;
    onTerminalExit(callback: (payload: {
        sessionId: string;
        exitCode: number;
    }) => void): () => void;
    windowMinimize(): Promise<ApiResult>;
    windowToggleMaximize(): Promise<ApiResult<{
        maximized: boolean;
    }>>;
    windowClose(): Promise<ApiResult>;
    windowIsMaximized(): Promise<boolean>;
    windowIsFullScreen(): Promise<boolean>;
    onWindowMaximized(callback: (maximized: boolean) => void): () => void;
    onWindowFullScreen(callback: (fullScreen: boolean) => void): () => void;
    hasCustomTitleBar: boolean;
    hasMacTrafficLights: boolean;
    onWorkspaceOpened(callback: (payload: {
        workspacePath: string;
        recentWorkspaces: string[];
        filePath?: string;
    }) => void): () => void;
    onWorkspaceChanged(callback: () => void): () => void;
    onChatDelta(callback: (payload: {
        requestId: string;
        delta: string;
    }) => void): () => void;
    onChatDone(callback: (payload: {
        requestId: string;
    }) => void): () => void;
    onChatError(callback: (payload: {
        requestId: string;
        error: string;
    }) => void): () => void;
    onAgentEvent(callback: (payload: {
        requestId: string;
        event: Omit<AgentActivity, "at">;
    }) => void): () => void;
    onAgentTranscript(callback: (payload: {
        requestId: string;
        turns: AgentTranscriptTurn[];
    }) => void): () => void;
};
declare global {
    interface Window {
        voidscribe: VoidScribeApi;
    }
}
