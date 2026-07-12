import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type MouseEvent, } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { AgentActivity, PtySessionInfo, UiLanguage } from "@/types";
import { formatToolActivity } from "@/lib/console-lines";
import { t } from "@/lib/i18n";
import { LogTextPanel } from "@/features/terminal/components/LogTextPanel";
import { TerminalContextMenu } from "@/features/terminal/components/TerminalContextMenu";
import { TerminalPane } from "@/features/terminal/components/TerminalPane";
import {
    appendLogLine,
    clampTerminalHeight,
    PANEL_TABS,
    readStoredTerminalHeight,
    TERMINAL_HEIGHT_KEY,
    type PanelTabId,
} from "@/features/terminal/lib/terminal-utils";

export type WorkspaceConsoleHandle = {
    handleActivity: (activity: AgentActivity) => void;
    writeln: (text: string) => void;
    focus: () => void;
};

type WorkspaceConsoleProps = {
    workspacePath: string;
    lang: UiLanguage;
    hidden?: boolean;
    onClose: () => void;
    onAgentInterrupt?: () => void;
};

export const WorkspaceConsole = forwardRef<WorkspaceConsoleHandle, WorkspaceConsoleProps>(function WorkspaceConsole({ workspacePath, lang, hidden = false, onClose, onAgentInterrupt }, ref) {
    const [panelHeight, setPanelHeight] = useState(readStoredTerminalHeight);
    const [resizing, setResizing] = useState(false);
    const [sessions, setSessions] = useState<PtySessionInfo[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [bootError, setBootError] = useState("");
    const [panelTab, setPanelTab] = useState<PanelTabId>("terminal");
    const [outputLines, setOutputLines] = useState<string[]>([]);
    const [debugLines, setDebugLines] = useState<string[]>([]);
    const [problemsText, setProblemsText] = useState("");
    const [problemsLoading, setProblemsLoading] = useState(false);
    const [portsText, setPortsText] = useState("");
    const [portsLoading, setPortsLoading] = useState(false);
    const [logContextMenu, setLogContextMenu] = useState<{
        x: number;
        y: number;
        canCopy: boolean;
        text: string;
    } | null>(null);
    const outputScrollRef = useRef<HTMLDivElement>(null);
    const debugScrollRef = useRef<HTMLDivElement>(null);
    const panelHeightRef = useRef(panelHeight);
    const workspaceRef = useRef(workspacePath);
    const activeIdRef = useRef(activeId);
    const panesRef = useRef(new Map<string, { term: Terminal; fit: FitAddon }>());
    const mirrorSessionIdRef = useRef<string | null>(null);
    const sessionOutputLogRef = useRef(new Map<string, string>());
    panelHeightRef.current = panelHeight;
    workspaceRef.current = workspacePath;
    activeIdRef.current = activeId;
    mirrorSessionIdRef.current = sessions.find((session) => session.mirror)?.id ?? null;
    const hasWorkspace = Boolean(workspacePath.trim());

    const applySessionList = useCallback((list: { sessions: PtySessionInfo[]; activeId: string | null }) => {
        setSessions(list.sessions);
        setActiveId(list.activeId);
        if (list.sessions.length === 0) {
            onClose();
        }
    }, [onClose]);
    const applySessionListRef = useRef(applySessionList);
    applySessionListRef.current = applySessionList;

    const appendSessionOutput = useCallback((sessionId: string, data: string) => {
        sessionOutputLogRef.current.set(sessionId, (sessionOutputLogRef.current.get(sessionId) ?? "") + data);
        const pane = panesRef.current.get(sessionId);
        if (pane) {
            pane.term.write(data);
            pane.term.scrollToBottom();
        }
    }, []);

    const syncMirrorSession = useCallback(async (): Promise<string | null> => {
        const ensured = await window.voidscribe.terminalEnsureAgentMirror();
        const mirror = ensured.session?.mirror === true
            ? ensured.session
            : ensured.sessions.find((session) => session.mirror);
        if (!mirror)
            return null;
        activeIdRef.current = mirror.id;
        mirrorSessionIdRef.current = mirror.id;
        applySessionListRef.current({ sessions: ensured.sessions, activeId: mirror.id });
        setPanelTab("terminal");
        return mirror.id;
    }, []);

    const fitActiveTerminal = useCallback((options?: { focus?: boolean }) => {
        const id = activeIdRef.current;
        if (!id)
            return;
        const pane = panesRef.current.get(id);
        if (!pane)
            return;
        try {
            pane.fit.fit();
            const dims = pane.fit.proposeDimensions();
            if (dims && dims.cols > 0 && dims.rows > 0) {
                void window.voidscribe.terminalResize(id, dims.cols, dims.rows);
            }
            if (options?.focus) {
                pane.term.focus();
            }
        }
        catch {
        }
    }, []);

    const registerPane = useCallback((sessionId: string, term: Terminal, fit: FitAddon) => {
        panesRef.current.set(sessionId, { term, fit });
        const replayLog = () => {
            const log = sessionOutputLogRef.current.get(sessionId);
            if (!log)
                return;
            term.reset();
            term.write(log);
            term.scrollToBottom();
        };
        replayLog();
        requestAnimationFrame(replayLog);
        if (sessionId === activeIdRef.current) {
            requestAnimationFrame(() => fitActiveTerminal());
        }
    }, [fitActiveTerminal]);

    const unregisterPane = useCallback((sessionId: string) => {
        panesRef.current.delete(sessionId);
    }, []);

    const replaySessionOutput = useCallback((sessionId: string) => {
        const log = sessionOutputLogRef.current.get(sessionId);
        if (!log)
            return;
        const pane = panesRef.current.get(sessionId);
        if (!pane)
            return;
        pane.term.reset();
        pane.term.write(log);
        pane.term.scrollToBottom();
    }, []);

    const mirrorAgentActivity = useCallback((_activity: AgentActivity) => {
        void (async () => {
            const mirrorId = mirrorSessionIdRef.current ?? (await syncMirrorSession());
            if (!mirrorId)
                return;
            activeIdRef.current = mirrorId;
            setActiveId(mirrorId);
            setPanelTab("terminal");
            requestAnimationFrame(() => fitActiveTerminal());
        })();
    }, [fitActiveTerminal, syncMirrorSession]);

    useImperativeHandle(ref, () => ({
        handleActivity(activity: AgentActivity) {
            const debugLine = (() => {
                switch (activity.type) {
                    case "tool_start":
                        return `▶ ${formatToolActivity(activity.name, activity.detail)}`;
                    case "tool_done":
                        return `✓ ${formatToolActivity(activity.name, activity.detail)}`;
                    case "console_command":
                        return `[agent] ${activity.command}`;
                    case "console_output":
                        return activity.stream === "stderr" ? `[stderr] ${activity.text}` : activity.text;
                    default:
                        return null;
                }
            })();
            if (debugLine) {
                setDebugLines((prev) => appendLogLine(prev, debugLine));
                if (activity.type === "console_command" || activity.type === "console_output") {
                    setOutputLines((prev) => appendLogLine(prev, debugLine));
                }
            }
            if (activity.type === "console_command" ||
                activity.type === "console_output" ||
                (activity.type === "tool_start" && activity.name === "run_command")) {
                mirrorAgentActivity(activity);
            }
        },
        writeln(text: string) {
            setOutputLines((prev) => appendLogLine(prev, text));
            setDebugLines((prev) => appendLogLine(prev, text));
            const currentActiveId = activeIdRef.current;
            const mirrorId = mirrorSessionIdRef.current;
            if (!currentActiveId || currentActiveId === mirrorId)
                return;
            panesRef.current.get(currentActiveId)?.term.writeln(text);
        },
        focus() {
            fitActiveTerminal({ focus: true });
        },
    }), [fitActiveTerminal, mirrorAgentActivity]);

    useEffect(() => {
        const removeUpdated = window.voidscribe.onTerminalUpdated(({ sessions: nextSessions, activeId: nextActiveId }) => {
            const mirror = nextSessions.find((session) => session.mirror);
            if (mirror) {
                mirrorSessionIdRef.current = mirror.id;
            }
            const nextActive = nextActiveId ?? nextSessions[0]?.id ?? null;
            activeIdRef.current = nextActive;
            setSessions(nextSessions);
            setActiveId(nextActive);
            if (mirror) {
                requestAnimationFrame(() => replaySessionOutput(mirror.id));
            }
            if (panelTab === "terminal") {
                requestAnimationFrame(() => fitActiveTerminal());
            }
        });
        const removeData = window.voidscribe.onTerminalData(({ sessionId, data }) => {
            appendSessionOutput(sessionId, data);
        });
        const removeExit = window.voidscribe.onTerminalExit(({ sessionId, exitCode }) => {
            panesRef.current.get(sessionId)?.term.writeln(`\r\n\x1b[90m${t(lang, "terminalSessionEnded", exitCode)}\x1b[0m`);
            setSessions((prev) => prev.map((item) => item.id === sessionId ? { ...item, alive: false } : item));
        });
        return () => {
            removeUpdated();
            removeData();
            removeExit();
        };
    }, [lang, fitActiveTerminal, replaySessionOutput, appendSessionOutput, panelTab]);

    useEffect(() => {
        let cancelled = false;
        async function boot() {
            if (hidden)
                return;
            const cwd = workspaceRef.current.trim();
            if (!cwd) {
                setBootError(t(lang, "terminalSelectFolder"));
                setSessions([]);
                setActiveId(null);
                return;
            }
            setBootError("");
            const list = await window.voidscribe.terminalList();
            if (cancelled)
                return;
            if (list.sessions.length === 0) {
                const created = await window.voidscribe.terminalCreate(cwd);
                if (cancelled)
                    return;
                if (!created.ok) {
                    setBootError(created.error);
                    setSessions([]);
                    setActiveId(null);
                    return;
                }
                setSessions([created.session]);
                setActiveId(created.session.id);
                requestAnimationFrame(() => fitActiveTerminal());
                return;
            }
            setSessions(list.sessions);
            setActiveId(list.activeId ?? list.sessions[0]?.id ?? null);
            requestAnimationFrame(() => fitActiveTerminal());
        }
        void boot();
        return () => {
            cancelled = true;
        };
    }, [workspacePath, lang, fitActiveTerminal, hidden]);

    useEffect(() => {
        const timer = window.setTimeout(fitActiveTerminal, 80);
        return () => window.clearTimeout(timer);
    }, [activeId, panelHeight, sessions.length, panelTab, fitActiveTerminal]);

    useEffect(() => {
        function handleResize() {
            setPanelHeight((current) => clampTerminalHeight(current));
            fitActiveTerminal();
        }
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [fitActiveTerminal]);

    useEffect(() => {
        if (panelTab !== "problems" || !hasWorkspace)
            return;
        let cancelled = false;
        async function loadProblems() {
            setProblemsLoading(true);
            const result = await window.voidscribe.runWorkspaceCommand("npx tsc --noEmit 2>&1", ".");
            if (cancelled)
                return;
            setProblemsLoading(false);
            if (!result.ok) {
                setProblemsText(result.error);
                return;
            }
            const { stdout, stderr } = result.result;
            const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
            setProblemsText(combined || t(lang, "consoleNoProblems"));
        }
        void loadProblems();
        return () => {
            cancelled = true;
        };
    }, [panelTab, workspacePath, hasWorkspace, lang]);

    useEffect(() => {
        if (panelTab !== "ports" || !hasWorkspace)
            return;
        let cancelled = false;
        async function loadPorts() {
            setPortsLoading(true);
            const isWin = navigator.platform.toLowerCase().includes("win");
            const command = isWin
                ? "netstat -ano | findstr LISTENING"
                : "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null";
            const result = await window.voidscribe.runWorkspaceCommand(command, ".");
            if (cancelled)
                return;
            setPortsLoading(false);
            if (!result.ok) {
                setPortsText(result.error);
                return;
            }
            const { stdout, stderr } = result.result;
            const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
            setPortsText(combined || t(lang, "consoleNoPorts"));
        }
        void loadPorts();
        return () => {
            cancelled = true;
        };
    }, [panelTab, workspacePath, hasWorkspace, lang]);

    useEffect(() => {
        outputScrollRef.current?.scrollTo({ top: outputScrollRef.current.scrollHeight });
    }, [outputLines]);
    useEffect(() => {
        debugScrollRef.current?.scrollTo({ top: debugScrollRef.current.scrollHeight });
    }, [debugLines]);

    async function handleNewTerminal() {
        const cwd = workspacePath.trim();
        if (!cwd) {
            setBootError(t(lang, "terminalSelectFolder"));
            return;
        }
        const result = await window.voidscribe.terminalCreate(cwd);
        if (!result.ok) {
            setBootError(result.error);
            return;
        }
        setBootError("");
        setPanelTab("terminal");
        setSessions((prev) => [...prev, result.session]);
        setActiveId(result.session.id);
        await window.voidscribe.terminalSelect(result.session.id);
    }

    async function handleSelectSession(id: string) {
        await window.voidscribe.terminalSelect(id);
        activeIdRef.current = id;
        setActiveId(id);
        setPanelTab("terminal");
        requestAnimationFrame(() => fitActiveTerminal({ focus: true }));
    }

    async function handleKillSession(id: string, event: MouseEvent, isMirror = false) {
        event.stopPropagation();
        if (isMirror)
            onAgentInterrupt?.();
        const list = await window.voidscribe.terminalKill(id);
        panesRef.current.delete(id);
        sessionOutputLogRef.current.delete(id);
        applySessionList(list);
    }

    function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
        event.preventDefault();
        const startY = event.clientY;
        const startHeight = panelHeightRef.current;
        const handle = event.currentTarget;
        handle.setPointerCapture(event.pointerId);
        setResizing(true);
        document.body.classList.add("terminal-panel--resizing-body");
        const onMove = (moveEvent: PointerEvent) => {
            const next = clampTerminalHeight(startHeight - (moveEvent.clientY - startY));
            panelHeightRef.current = next;
            setPanelHeight(next);
        };
        const onUp = (upEvent: PointerEvent) => {
            try {
                handle.releasePointerCapture(upEvent.pointerId);
            }
            catch {
            }
            setResizing(false);
            document.body.classList.remove("terminal-panel--resizing-body");
            try {
                localStorage.setItem(TERMINAL_HEIGHT_KEY, String(panelHeightRef.current));
            }
            catch {
            }
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            fitActiveTerminal();
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    }

    function handleLogContextMenu(event: MouseEvent<HTMLElement>) {
        event.preventDefault();
        const text = window.getSelection()?.toString() ?? "";
        setLogContextMenu({
            x: event.clientX,
            y: event.clientY,
            canCopy: text.trim().length > 0,
            text,
        });
    }

    return (
        <section
            className={`terminal-panel terminal-panel--open terminal-panel--editor-dock${resizing ? " terminal-panel--resizing" : ""}${hidden ? " terminal-panel--hidden" : ""}`}
            style={{ height: hidden ? 0 : panelHeight }}
            aria-label={t(lang, "titleTerminal")}
        >
            <div
                className="terminal-panel__resize-handle"
                onPointerDown={handleResizePointerDown}
                role="separator"
                aria-orientation="horizontal"
                aria-label={t(lang, "terminalResize")}
            />
            <header className="terminal-panel__tabbar terminal-panel__tabbar--header">
                {PANEL_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`terminal-panel__tab${panelTab === tab.id ? " terminal-panel__tab--active" : ""}`}
                        onClick={() => setPanelTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
                <div className="terminal-panel__tabbar-spacer" />
                <button type="button" className="terminal-panel__tool-btn" onClick={() => void handleNewTerminal()} aria-label={t(lang, "terminalNew")} title={t(lang, "terminalNew")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
                <button type="button" className="terminal-panel__tool-btn" onClick={onClose} aria-label={t(lang, "terminalHide")} title={t(lang, "terminalHide")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>

            {panelTab === "terminal" ? (
                <div className="terminal-panel__workspace">
                    <div className="terminal-panel__main" onClick={() => fitActiveTerminal({ focus: true })}>
                        {!hasWorkspace ? (
                            <div className="terminal-panel__placeholder terminal-panel__placeholder--inline">
                                <p>{bootError || t(lang, "terminalSelectFolder")}</p>
                            </div>
                        ) : bootError && sessions.length === 0 ? (
                            <div className="terminal-panel__placeholder terminal-panel__placeholder--inline">
                                <p>{bootError}</p>
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <TerminalPane
                                    key={session.id}
                                    sessionId={session.id}
                                    active={session.id === activeId}
                                    lang={lang}
                                    readonly={Boolean(session.mirror)}
                                    onInterrupt={session.mirror ? onAgentInterrupt : undefined}
                                    onRegister={registerPane}
                                    onUnregister={unregisterPane}
                                />
                            ))
                        )}
                    </div>
                    <aside className="terminal-panel__sidebar" aria-label={t(lang, "terminalList")}>
                        {sessions.map((session) => {
                            const isActive = session.id === activeId;
                            return (
                                <div key={session.id} className={`terminal-panel__session-row${isActive ? " terminal-panel__session-row--active" : ""}`}>
                                    <button
                                        type="button"
                                        className={`terminal-panel__session${isActive ? " terminal-panel__session--active" : ""}${session.alive ? "" : " terminal-panel__session--dead"}${session.mirror ? " terminal-panel__session--mirror" : ""}`}
                                        onClick={() => void handleSelectSession(session.id)}
                                        title={session.title}
                                    >
                                        <span className="terminal-panel__session-bar" aria-hidden />
                                        <svg className="terminal-panel__session-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                            <rect x="3" y="4" width="18" height="14" rx="2" />
                                            <path d="M7 8h6M7 12h10" />
                                        </svg>
                                        <span className="terminal-panel__session-label">{session.title}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="terminal-panel__session-kill"
                                        onClick={(event) => void handleKillSession(session.id, event, Boolean(session.mirror))}
                                        aria-label={t(lang, "terminalClose", session.title)}
                                        title={session.mirror ? t(lang, "agentTerminalClose") : t(lang, "terminalClose", session.title)}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </aside>
                </div>
            ) : panelTab === "output" ? (
                <LogTextPanel lang={lang} lines={outputLines} emptyKey="consoleNoOutput" scrollRef={outputScrollRef} onContextMenu={handleLogContextMenu} />
            ) : panelTab === "debug" ? (
                <LogTextPanel lang={lang} lines={debugLines} emptyKey="consoleNoDebug" scrollRef={debugScrollRef} onContextMenu={handleLogContextMenu} />
            ) : panelTab === "problems" ? (
                problemsLoading ? (
                    <div className="terminal-panel__scroll terminal-panel__scroll--empty overlay-scrollbar">
                        <p>{t(lang, "consoleChecking")}</p>
                    </div>
                ) : (
                    <div className="terminal-panel__scroll overlay-scrollbar" onContextMenu={handleLogContextMenu}>
                        <pre className="terminal-line">{problemsText || t(lang, "consoleNoProblems")}</pre>
                    </div>
                )
            ) : panelTab === "ports" ? (
                portsLoading ? (
                    <div className="terminal-panel__scroll terminal-panel__scroll--empty overlay-scrollbar">
                        <p>{t(lang, "consoleChecking")}</p>
                    </div>
                ) : (
                    <div className="terminal-panel__scroll overlay-scrollbar" onContextMenu={handleLogContextMenu}>
                        <pre className="terminal-line">{portsText || t(lang, "consoleNoPorts")}</pre>
                    </div>
                )
            ) : null}

            {logContextMenu ? (
                <TerminalContextMenu
                    menu={logContextMenu}
                    lang={lang}
                    canPaste={false}
                    onCopy={() => {
                        if (logContextMenu.text) {
                            void navigator.clipboard.writeText(logContextMenu.text);
                        }
                    }}
                    onPaste={() => { }}
                    onClose={() => setLogContextMenu(null)}
                />
            ) : null}
        </section>
    );
});
