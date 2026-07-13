import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { CodeEditorPanel } from "@/components/CodeEditorPanel";
import { EditorTabsBar } from "@/components/EditorTabsBar";
import { MessageList } from "@/components/MessageList";
import { WorkspaceConsole, type WorkspaceConsoleHandle } from "@/components/WorkspaceConsole";
import { SettingsScreen } from "@/features/settings/components/SettingsScreen";
import { OnboardingWizard, type OnboardingFinishPayload } from "@/features/onboarding/components/OnboardingWizard";
import { ChatComposer } from "@/features/chat/components/ChatComposer";
import { useAgentStream } from "@/features/chat/hooks/useAgentStream";
import { useChatSend } from "@/features/chat/hooks/useChatSend";
import { usePendingChanges } from "@/features/agent/hooks/usePendingChanges";
import { ChatTabsBar } from "@/components/ChatTabsBar";
import { TitleBar } from "@/components/TitleBar";
import { UnsavedFileDialog } from "@/components/UnsavedFileDialog";
import { useEditorTabs } from "@/hooks/useEditorTabs";
import { useFileTreeLintStatus } from "@/hooks/useFileTreeLintStatus";
import { useChatSessions } from "@/hooks/useChatSessions";
import { applyTheme } from "@/lib/theme-vars";
import { buildTitleBarFileMenu } from "@/lib/file-menu";
import { t } from "@/lib/i18n";
import { getReadyPresets, isPresetReady } from "@/lib/agent-presets";
import { modelSupportsVision } from "@/lib/model-vision";
import { loadEditorTabsForWorkspace, saveEditorTabsForWorkspace, } from "@/lib/persisted-ui-state";
import type { AgentEditorContext, AiSettings, LocalProviderStatus, SettingsSavePatch, UiLanguage, UiTheme, } from "@/types";
import { chatContextRefFromPath, mergeContextRefs } from "@/lib/chat-context";
import { formatSelectionForChat, type EditorSelectionInfo } from "@/lib/editor-selection";
import { normalizeChatMode, type ChatInteractionMode } from "@/lib/chat-modes";
const DEFAULT_SETTINGS: AiSettings = {
    activePresetId: "",
    presets: [],
    provider: "openai",
    model: "gpt-4.1-mini",
    apiKey: "",
    baseUrl: "",
    language: "en",
    theme: "voidscribe",
    windowLayout: "editor",
    defaultChatMode: "agent",
};
const SIDEBAR_WIDTH_KEY = "voidscribe-sidebar-width-v1";
const CHAT_WIDTH_KEY = "voidscribe-chat-width-v1";
function readStoredWidth(key: string, fallback: number): number {
    try {
        const value = Number.parseInt(localStorage.getItem(key) ?? "", 10);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }
    catch {
        return fallback;
    }
}
export function App() {
    const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
    const [workspacePath, setWorkspacePath] = useState("");
    const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
    const [workspaceError, setWorkspaceError] = useState("");
    const [treeRefreshKey, setTreeRefreshKey] = useState(0);
    const [treeFilePaths, setTreeFilePaths] = useState<string[]>([]);
    const [view, setView] = useState<"ide" | "settings">("ide");
    const [mode, setModeState] = useState<ChatInteractionMode>("agent");
    const [composer, setComposer] = useState("");
    const [composerImages, setComposerImages] = useState<import("@/types").ChatImage[]>([]);
    const [composerContextRefs, setComposerContextRefs] = useState<import("@/types").ChatContextRef[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [chatOpen, setChatOpen] = useState(true);
    const [terminalOpen, setTerminalOpen] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(() => readStoredWidth(SIDEBAR_WIDTH_KEY, 260));
    const [chatWidth, setChatWidth] = useState(() => readStoredWidth(CHAT_WIDTH_KEY, 380));
    const [pendingOpenPath, setPendingOpenPath] = useState<string | null>(null);
    const [localDiscovery, setLocalDiscovery] = useState<LocalProviderStatus[]>([]);
    const [providerModels, setProviderModels] = useState<string[]>([]);
    const [appReady, setAppReady] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingLang, setOnboardingLang] = useState<UiLanguage>("en");
    const [onboardingTheme, setOnboardingTheme] = useState<UiTheme>("voidscribe");
    const editor = useEditorTabs();
    const chats = useChatSessions();
    const chatsRef = useRef(chats);
    chatsRef.current = chats;
    const lang = (settings.language ?? "en") as UiLanguage;
    const isChatLayout = (settings.windowLayout ?? "editor") === "agent";
    const resizeRef = useRef<"sidebar" | "chat" | null>(null);
    const consoleRef = useRef<WorkspaceConsoleHandle>(null);
    const editorApiRef = useRef(editor);
    editorApiRef.current = editor;
    const restoringTabsRef = useRef(false);
    const [isRestoringTabs, setIsRestoringTabs] = useState(false);
    const getActiveEditorContentRef = useRef<(() => string | null) | null>(null);
    const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
    const [unsavedClose, setUnsavedClose] = useState<{
        tabId: string;
        content: string;
        path: string;
    } | null>(null);
    const [unsavedClosing, setUnsavedClosing] = useState(false);
    const [unsavedError, setUnsavedError] = useState("");
    const restoreWorkspaceTabs = useCallback(async (path: string, alsoOpen?: string) => {
        if (!path.trim()) {
            editorApiRef.current.closeAllTabs();
            return;
        }
        restoringTabsRef.current = true;
        setIsRestoringTabs(true);
        try {
            const saved = loadEditorTabsForWorkspace(path);
            if (saved) {
                await editorApiRef.current.restoreTabs(saved.paths, saved.activePath);
            }
            else {
                editorApiRef.current.closeAllTabs();
            }
            if (alsoOpen) {
                await editorApiRef.current.openFile(alsoOpen);
            }
        }
        finally {
            restoringTabsRef.current = false;
            setIsRestoringTabs(false);
        }
    }, []);
    const refreshTreeNow = useCallback(() => {
        setTreeRefreshKey((key) => key + 1);
    }, []);
    const refreshTreeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refreshTree = useCallback(() => {
        if (refreshTreeTimerRef.current)
            clearTimeout(refreshTreeTimerRef.current);
        refreshTreeTimerRef.current = setTimeout(() => {
            refreshTreeTimerRef.current = null;
            refreshTreeNow();
        }, 700);
    }, [refreshTreeNow]);
    useEffect(() => () => {
        if (refreshTreeTimerRef.current)
            clearTimeout(refreshTreeTimerRef.current);
    }, []);
    const pending = usePendingChanges({
        activeSessionId: chats.activeSessionId,
        sessions: chats.sessions,
        workspacePath,
        editor,
        refreshTree,
    });
    const fileTreeErrorPaths = useFileTreeLintStatus({
        workspacePath,
        tabs: editor.tabs,
        pendingChanges: pending.sessionPending,
        treeFilePaths,
    });
    const agentStream = useAgentStream({
        lang,
        workspacePath,
        chatsRef,
        consoleRef,
        refreshTree,
        autoOpenTerminal: !isChatLayout,
        onTerminalOpen: () => setTerminalOpen(true),
        onFileChange: pending.trackFileChange,
        verifyPendingAfterFlush: pending.verifyPendingAfterFlush,
    });
    const { streaming, chatInflightRef, registerStream, clearStream, cancelStream, stopGeneration, } = agentStream;
    const clearComposer = useCallback(() => {
        setComposer("");
        setComposerImages([]);
        setComposerContextRefs([]);
    }, []);
    const activePreset = getReadyPresets(settings).find((item) => item.id === settings.activePresetId) ??
        getReadyPresets(settings)[0] ??
        null;
    const editorContext = useMemo<AgentEditorContext>(() => ({
        activePath: editor.activePath,
        openPaths: editor.tabs.map((tab) => tab.path),
    }), [editor.activePath, editor.tabs]);
    const { sendMessage } = useChatSend({
        lang,
        mode,
        workspacePath,
        activePreset,
        composer,
        composerImages,
        composerContextRefs,
        streaming,
        chatInflightRef,
        chats,
        chatsRef,
        editorContext,
        onComposerClear: clearComposer,
        onWorkspaceError: setWorkspaceError,
        registerStream,
        clearStream,
    });
    const registerActiveEditorContent = useCallback((getter: () => string | null) => {
        getActiveEditorContentRef.current = getter;
    }, []);
    const handleAddSelectionToChat = useCallback((selection: EditorSelectionInfo) => {
        if (!isChatLayout)
            setChatOpen(true);
        if (selection.path.trim() && workspacePath.trim()) {
            setComposerContextRefs((refs) => mergeContextRefs(refs, chatContextRefFromPath(selection.path)));
        }
        const block = formatSelectionForChat(selection, lang);
        setComposer((prev) => (prev.trim() ? `${prev.trim()}\n\n${block}` : block));
        requestAnimationFrame(() => composerInputRef.current?.focus());
    }, [isChatLayout, lang, workspacePath]);
    const aiReady = Boolean(activePreset && isPresetReady(activePreset));
    const handleCloseTab = useCallback((tabId: string) => {
        const tab = editor.tabs.find((item) => item.id === tabId);
        if (!tab)
            return;
        let content = tab.content;
        if (tabId === editor.activeId) {
            const live = getActiveEditorContentRef.current?.();
            if (live !== null && live !== undefined) {
                content = live;
            }
        }
        const normalizedContent = content.replace(/\r\n/g, "\n");
        const normalizedSaved = tab.savedContent.replace(/\r\n/g, "\n");
        if (normalizedContent === normalizedSaved) {
            editor.removeTab(tabId);
            return;
        }
        setUnsavedClose({ tabId, content: normalizedContent, path: tab.path });
        setUnsavedError("");
    }, [editor.tabs, editor.activeId, editor.removeTab]);
    const handleEditorSaveAs = useCallback((content: string) => {
        void editorApiRef.current.saveActiveTabAs(content);
    }, []);
    const handleUnsavedSave = useCallback(async () => {
        if (!unsavedClose)
            return;
        setUnsavedClosing(true);
        setUnsavedError("");
        try {
            let content = unsavedClose.content;
            if (unsavedClose.tabId === editorApiRef.current.activeId) {
                const live = getActiveEditorContentRef.current?.();
                if (live !== null && live !== undefined) {
                    content = live.replace(/\r\n/g, "\n");
                }
            }
            const writeResult = await window.voidscribe.writeWorkspaceFile(unsavedClose.path, content);
            if (!writeResult.ok) {
                setUnsavedError(writeResult.error);
                editorApiRef.current.resetTabSaving(unsavedClose.tabId);
                return;
            }
            editorApiRef.current.removeTabByPath(unsavedClose.path);
            setUnsavedClose(null);
        }
        finally {
            setUnsavedClosing(false);
        }
    }, [unsavedClose]);
    const handleUnsavedDiscard = useCallback(() => {
        if (!unsavedClose)
            return;
        editorApiRef.current.resetTabSaving(unsavedClose.tabId);
        editorApiRef.current.removeTabByPath(unsavedClose.path);
        setUnsavedClose(null);
        setUnsavedError("");
    }, [unsavedClose]);
    const handleUnsavedCancel = useCallback(() => {
        if (unsavedClose) {
            editorApiRef.current.resetTabSaving(unsavedClose.tabId);
            if (unsavedClose.tabId === editorApiRef.current.activeId) {
                const live = getActiveEditorContentRef.current?.();
                if (live !== null && live !== undefined) {
                    editorApiRef.current.syncTabContent(unsavedClose.tabId, live);
                }
            }
        }
        setUnsavedClose(null);
        setUnsavedError("");
    }, [unsavedClose]);
    useEffect(() => {
        void window.voidscribe.getAppState().then(async (result) => {
            if (!result.ok) {
                setAppReady(true);
                return;
            }
            setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
            if ((result.settings?.windowLayout ?? DEFAULT_SETTINGS.windowLayout) === "agent") {
                setTerminalOpen(false);
            }
            setRecentWorkspaces(result.recentWorkspaces ?? []);
            const savedMode = normalizeChatMode(result.settings.defaultChatMode);
            setModeState(savedMode);
            setLocalDiscovery(result.localDiscovery ?? []);
            const path = result.workspacePath ?? "";
            setWorkspacePath(path);
            if (path) {
                await restoreWorkspaceTabs(path);
            }
            setShowOnboarding(result.onboardingCompleted === false);
            setOnboardingLang((result.settings?.language ?? "en") as UiLanguage);
            setAppReady(true);
        });
    }, [restoreWorkspaceTabs]);
    const refreshProviderModels = useCallback(async (input?: {
        provider?: import("@/lib/providers").UserAiProviderId;
        apiKey?: string;
        baseUrl?: string;
    }) => {
        const result = await window.voidscribe.listProviderModels(input);
        if (result.ok) {
            setProviderModels(result.models);
        }
    }, []);
    const setMode = useCallback((next: ChatInteractionMode) => {
        setModeState(next);
        void window.voidscribe.saveSettings({ defaultChatMode: next }).then((result) => {
            if (result.ok) {
                setSettings((prev) => ({ ...prev, defaultChatMode: next }));
            }
        });
    }, []);
    useEffect(() => {
        void refreshProviderModels();
    }, [settings.provider, settings.baseUrl, settings.apiKey, refreshProviderModels]);
    useEffect(() => {
        let cancelled = false;
        const timer = window.setInterval(() => {
            void window.voidscribe.discoverLocalProviders().then((result) => {
                if (cancelled || !result.ok)
                    return;
                setLocalDiscovery(result.discovery);
            });
        }, 15000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, []);
    useEffect(() => {
        applyTheme(settings.theme ?? "voidscribe");
    }, [settings.theme]);
    useEffect(() => {
        try {
            localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
            localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth));
        }
        catch {
        }
    }, [sidebarWidth, chatWidth]);
    useEffect(() => {
        if (!workspacePath.trim() || isRestoringTabs || restoringTabsRef.current)
            return;
        saveEditorTabsForWorkspace(workspacePath, {
            paths: editor.tabs.map((tab) => tab.path),
            activePath: editor.activePath,
        });
    }, [workspacePath, editor.tabs, editor.activePath, isRestoringTabs]);
    useEffect(() => window.voidscribe.onWorkspaceChanged(refreshTree), [refreshTree]);
    useEffect(() => {
        return window.voidscribe.onWorkspaceOpened(async (payload) => {
            setWorkspacePath(payload.workspacePath);
            setRecentWorkspaces(payload.recentWorkspaces);
            refreshTree();
            await restoreWorkspaceTabs(payload.workspacePath, payload.filePath);
        });
    }, [refreshTree, restoreWorkspaceTabs]);
    useEffect(() => {
        function onMouseMove(event: MouseEvent) {
            if (!resizeRef.current)
                return;
            if (resizeRef.current === "sidebar") {
                setSidebarWidth(Math.min(520, Math.max(180, event.clientX)));
            }
            else {
                const width = window.innerWidth - event.clientX;
                setChatWidth(Math.min(720, Math.max(280, width)));
            }
        }
        function onMouseUp() {
            if (!resizeRef.current)
                return;
            resizeRef.current = null;
            document.body.classList.remove("sidebar--resizing", "editor-chat--resizing");
        }
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, []);
    const saveSettings = useCallback(async (patch: SettingsSavePatch = {}) => {
        const result = await window.voidscribe.saveSettings(patch);
        if (result.ok)
            setSettings(result.settings);
        return result.ok;
    }, []);
    const pickWorkspace = useCallback(async () => {
        const result = await window.voidscribe.pickWorkspace();
        if (result.ok) {
            setWorkspacePath(result.workspacePath);
            setRecentWorkspaces(result.recentWorkspaces);
            refreshTree();
            await restoreWorkspaceTabs(result.workspacePath);
        }
    }, [refreshTree, restoreWorkspaceTabs]);
    const pickWorkspaceFile = useCallback(async () => {
        const result = await window.voidscribe.pickWorkspaceFile();
        if (result.ok) {
            setWorkspacePath(result.workspacePath);
            setRecentWorkspaces(result.recentWorkspaces);
            refreshTree();
            await restoreWorkspaceTabs(result.workspacePath, result.filePath);
        }
    }, [refreshTree, restoreWorkspaceTabs]);
    const openRecentWorkspace = useCallback(async (path: string) => {
        const result = await window.voidscribe.setWorkspacePath(path);
        if (result.ok) {
            setWorkspacePath(result.workspacePath);
            setRecentWorkspaces((prev) => [path, ...prev.filter((item) => item !== path)].slice(0, 10));
            refreshTree();
            await restoreWorkspaceTabs(result.workspacePath);
        }
    }, [refreshTree, restoreWorkspaceTabs]);
    const handleOnboardingFinish = useCallback(async (payload: OnboardingFinishPayload) => {
        setSettings((prev) => ({
            ...prev,
            language: payload.language,
            theme: payload.theme,
        }));
        applyTheme(payload.theme);
        if (payload.workspacePath) {
            setWorkspacePath(payload.workspacePath);
            setRecentWorkspaces(payload.recentWorkspaces ?? []);
            refreshTree();
            await restoreWorkspaceTabs(payload.workspacePath, payload.filePath);
        }
        setShowOnboarding(false);
    }, [refreshTree, restoreWorkspaceTabs]);
    const fileMenuItems = useMemo(() => buildTitleBarFileMenu({
        onOpenFolder: () => void pickWorkspace(),
        onOpenFile: () => void pickWorkspaceFile(),
        onOpenRecent: (path) => void openRecentWorkspace(path),
    }), [openRecentWorkspace, pickWorkspace, pickWorkspaceFile]);
    const titleBarCenter = useMemo(() => {
        const active = editor.activePath?.trim();
        if (active)
            return active.split(/[/\\]/).pop() ?? active;
        const workspace = workspacePath.trim();
        if (workspace)
            return workspace.split(/[/\\]/).pop() ?? workspace;
        return undefined;
    }, [editor.activePath, workspacePath]);
    const handleSelectPreset = useCallback(async (presetId: string) => {
        await saveSettings({ activePresetId: presetId });
    }, [saveSettings]);
    const handleAttachChatFile = useCallback(async () => {
        if (!workspacePath.trim()) {
            setWorkspaceError(t(lang, "chatNeedsWorkspaceForFiles"));
            return;
        }
        const result = await window.voidscribe.pickChatAttachment();
        if (!result.ok) {
            if (result.error !== "cancelled")
                setWorkspaceError(result.error);
            return;
        }
        setWorkspaceError("");
        setComposerContextRefs((current) => mergeContextRefs(current, chatContextRefFromPath(result.filePath)));
    }, [lang, workspacePath]);
    const openEditorFile = useCallback((path: string) => editor.openFile(path), [editor]);
    const handleEditorSave = useCallback(async (content: string) => {
        const result = await editorApiRef.current.saveActiveTab(content);
        return result.ok;
    }, []);
    const handleEditorRevert = useCallback(() => {
        void editorApiRef.current.revertActiveTab();
    }, []);
    const activeMessageId = streaming?.messageId ?? null;
    const hasWorkspace = Boolean(workspacePath);
    useEffect(() => {
        if (isChatLayout) {
            setTerminalOpen(false);
        }
    }, [isChatLayout]);
    const handleOpenPendingFile = useCallback((path: string) => {
        if (isChatLayout) {
            setSettings((prev) => ({ ...prev, windowLayout: "editor" }));
            setChatOpen(true);
            setSidebarOpen(true);
            setPendingOpenPath(path);
            return;
        }
        void pending.openPendingFile(path);
    }, [isChatLayout, pending]);
    useEffect(() => {
        if (isChatLayout || !pendingOpenPath)
            return;
        const path = pendingOpenPath;
        setPendingOpenPath(null);
        void pending.openPendingFile(path);
    }, [isChatLayout, pending, pendingOpenPath]);
    const composerSupportsVision = activePreset
        ? modelSupportsVision(activePreset.provider, activePreset.model)
        : false;
    const handleCloseChatTab = useCallback(async (id: string) => {
        if (streaming?.sessionId === id) {
            await cancelStream(streaming.requestId);
        }
        const closingLast = chats.sessions.length === 1;
        if (closingLast && isChatLayout) {
            chats.clearSession(id);
            return;
        }
        chats.closeSession(id);
        if (closingLast && !isChatLayout) {
            setChatOpen(false);
        }
    }, [cancelStream, chats, isChatLayout, streaming]);
    const handleToggleChat = useCallback(() => {
        setChatOpen((wasOpen) => !wasOpen);
    }, []);
    useEffect(() => {
        if (chatOpen || isChatLayout) {
            chats.ensureSession();
        }
    }, [chatOpen, isChatLayout, chats.ensureSession]);
    const shellClass = [
        "app-shell",
        isChatLayout ? "app-shell--chat-layout" : sidebarOpen ? "" : "app-shell--collapsed",
        resizeRef.current === "sidebar" ? "app-shell--sidebar-resizing" : "",
        resizeRef.current === "chat" ? "app-shell--chat-resizing" : "",
    ]
        .filter(Boolean)
        .join(" ");
    if (!appReady) {
        return <div className="app-frame app-frame--boot" />;
    }
    if (showOnboarding) {
        return (<div className="app-frame app-frame--onboarding" data-theme={onboardingTheme}>
            <TitleBar
                lang={onboardingLang}
                minimal
                onOpenSettings={() => {}}
                onRequestClose={() => void window.voidscribe.windowClose()}
            />
            <OnboardingWizard
                initialTheme={settings.theme ?? "voidscribe"}
                onLanguageChange={setOnboardingLang}
                onThemeChange={setOnboardingTheme}
                onFinish={handleOnboardingFinish}
            />
        </div>);
    }
    if (view === "settings") {
        return (<div className="app-frame">
        <TitleBar lang={lang} recentWorkspaces={recentWorkspaces} fileMenuItems={fileMenuItems} centerTitle={titleBarCenter} settingsActive onOpenSettings={() => setView("ide")} onRequestClose={() => void window.voidscribe.windowClose()}/>
        <SettingsScreen settings={settings} lang={lang} localDiscovery={localDiscovery} providerModels={providerModels} onBack={() => setView("ide")} onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))} onSave={saveSettings} onRefreshModels={refreshProviderModels} onDiscoverLocal={async () => {
                const result = await window.voidscribe.discoverLocalProviders();
                if (result.ok)
                    setLocalDiscovery(result.discovery);
            }}/>
      </div>);
    }
    return (<div className="app-frame">
      <TitleBar lang={lang} recentWorkspaces={recentWorkspaces} fileMenuItems={fileMenuItems} centerTitle={titleBarCenter} sidebarOpen={sidebarOpen} chatOpen={chatOpen} onToggleSidebar={isChatLayout ? undefined : () => setSidebarOpen((open) => !open)} onToggleChat={isChatLayout ? undefined : handleToggleChat} terminalOpen={terminalOpen} onToggleTerminal={() => setTerminalOpen((open) => !open)} onOpenSettings={() => setView("settings")} onRequestClose={() => void window.voidscribe.windowClose()}/>
      <div className={shellClass}>
        {!isChatLayout ? (<div className="sidebar-panel" style={{ width: sidebarOpen ? sidebarWidth : 0 }}>
          <Sidebar workspacePath={workspacePath} selectedPath={editor.activePath} refreshKey={treeRefreshKey} lang={lang} pendingPaths={pending.workspacePendingPaths} errorPaths={fileTreeErrorPaths} onTreeFilePathsChange={setTreeFilePaths} onOpenFile={(path) => void openEditorFile(path)} onRefresh={refreshTreeNow} onEntriesDeleted={(entries) => editor.removeTabsForDeletedEntries(entries)}/>
        </div>) : null}
        {!isChatLayout && sidebarOpen ? (<button type="button" className="sidebar-panel__resizer" aria-label={t(lang, "titleSidebarHide")} onMouseDown={() => {
                resizeRef.current = "sidebar";
                document.body.classList.add("sidebar--resizing");
            }}/>) : null}
        <main className="main">
          <div className={`editor-workspace${isChatLayout ? " editor-workspace--chat-only" : ""}`}>
            {!isChatLayout ? (<section className="editor-workspace__main">
              <EditorTabsBar tabs={editor.tabs} activeId={editor.activeId} setActiveId={editor.setActiveId} closeTab={handleCloseTab} titleForPath={(path) => editor.buildEditorTabTitle(path, editor.tabs.map((tab) => tab.path))}/>
              <div className="editor-workspace__editor">
                <CodeEditorPanel tab={editor.activeTab} lang={lang} aiReady={aiReady} agentDiffActive={Boolean(pending.activeAgentPending)} agentDiffBaseline={pending.activeAgentPending?.previousContent ?? null} agentDiffAfter={pending.activeAgentPending?.newContent ?? null} onAddSelectionToChat={handleAddSelectionToChat} onAgentDiffUndo={() => {
                if (pending.activeAgentPending)
                    void pending.undoPendingChange(pending.activeAgentPending);
            }} onAgentDiffKeep={() => {
                if (pending.activeAgentPending)
                    pending.keepPendingChange(pending.activeAgentPending);
            }} onChange={editor.updateActiveContent} onSave={handleEditorSave} onRevert={handleEditorRevert} onSaveAs={handleEditorSaveAs} onRegisterGetContent={registerActiveEditorContent}/>
              </div>
              <WorkspaceConsole ref={consoleRef} workspacePath={workspacePath} lang={lang} hidden={!terminalOpen} onClose={() => setTerminalOpen(false)} onAgentInterrupt={stopGeneration}/>
            </section>) : null}
            {!isChatLayout ? (chatOpen ? (<button type="button" className="editor-workspace__resizer" aria-label={t(lang, "resizeChat")} onMouseDown={() => {
                resizeRef.current = "chat";
                document.body.classList.add("editor-chat--resizing");
            }}/>) : null) : null}
            <aside className={`editor-workspace__chat chat-panel${chatOpen || isChatLayout ? "" : " chat-panel--collapsed"}`} style={isChatLayout
            ? { width: "100%", maxWidth: "none" }
            : { width: chatOpen ? chatWidth : 0 }} aria-hidden={!isChatLayout && !chatOpen}>
                  <ChatTabsBar sessions={chats.sessions} activeId={chats.activeSessionId} canClear={(chats.activeSession?.messages.length ?? 0) > 0} lang={lang} onSelect={chats.setActiveSessionId} onClose={handleCloseChatTab} onCreate={chats.newSession} onClear={() => {
            if (chats.activeSessionId) {
                chats.clearSession(chats.activeSessionId);
            }
        }}/>
                  <MessageList messages={chats.activeSession?.messages ?? []} sessionId={chats.activeSessionId} streamingId={activeMessageId} chatActive={chatOpen || isChatLayout} lang={lang} onRestoreCheckpoint={(id) => void pending.restoreChatCheckpoint(id)}/>
                  <ChatComposer
                    lang={lang}
                    mode={mode}
                    hasWorkspace={hasWorkspace}
                    settings={settings}
                    workspacePath={workspacePath}
                    workspaceError={workspaceError}
                    composer={composer}
                    composerImages={composerImages}
                    composerContextRefs={composerContextRefs}
                    streaming={Boolean(streaming)}
                    composerSupportsVision={composerSupportsVision}
                    composerInputRef={composerInputRef}
                    sessionPending={pending.sessionPending}
                    onComposerChange={setComposer}
                    onImagesChange={setComposerImages}
                    onContextRefsChange={setComposerContextRefs}
                    onModeChange={setMode}
                    onSelectPreset={handleSelectPreset}
                    onOpenSettings={() => setView("settings")}
                    onAttachFile={handleAttachChatFile}
                    onSend={() => void sendMessage()}
                    onStop={() => void stopGeneration()}
                    onUndoPending={(change) => void pending.undoPendingChange(change)}
                    onKeepPending={(change) => void pending.keepPendingChange(change)}
                    onOpenFile={handleOpenPendingFile}
                  />
                  {isChatLayout ? (<WorkspaceConsole ref={consoleRef} workspacePath={workspacePath} lang={lang} hidden={!terminalOpen} onClose={() => setTerminalOpen(false)} onAgentInterrupt={stopGeneration}/>) : null}
            </aside>
          </div>
          {workspaceError ? <div className="code-editor__error">{workspaceError}</div> : null}
        </main>
      </div>
      <UnsavedFileDialog open={Boolean(unsavedClose)} filePath={unsavedClose?.path ?? ""} lang={lang} loading={unsavedClosing} error={unsavedError} onSave={() => void handleUnsavedSave()} onDiscard={handleUnsavedDiscard} onCancel={handleUnsavedCancel}/>
    </div>);
}
