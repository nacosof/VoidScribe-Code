import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { AgentActivity, TerminalSessionInfo } from "@/types";
import { formatToolActivity } from "@/lib/console-lines";

export type WorkspaceConsoleHandle = {
  handleActivity: (activity: AgentActivity) => void;
  writeln: (text: string) => void;
  focus: () => void;
};

type WorkspaceConsoleProps = {
  workspacePath: string;
  onClose: () => void;
  onEmpty: () => void;
};

const PANEL_TABS = [
  { id: "problems", label: "Problems", enabled: false },
  { id: "output", label: "Output", enabled: false },
  { id: "debug", label: "Debug Console", enabled: false },
  { id: "terminal", label: "Terminal", enabled: true },
  { id: "ports", label: "Ports", enabled: false },
] as const;

const TERMINAL_HEIGHT_KEY = "voidscribe-terminal-height";
const DEFAULT_TERMINAL_HEIGHT = 220;
const MIN_TERMINAL_HEIGHT = 120;
const MAX_TERMINAL_HEIGHT_RATIO = 0.72;

const VOID_TERMINAL_THEME = {
  background: "#0b0d13",
  foreground: "#e6e9f0",
  cursor: "#7e41b4",
  cursorAccent: "#0b0d13",
  selectionBackground: "rgba(81, 44, 132, 0.35)",
  black: "#1e1e1e",
  red: "#e8a0a0",
  green: "#4b9b6e",
  yellow: "#d4b06a",
  blue: "#9eb4ff",
  magenta: "#c8b4ff",
  cyan: "#7ec8e3",
  white: "#e6e9f0",
  brightBlack: "#8a8f9e",
  brightRed: "#f48771",
  brightGreen: "#6fcf97",
  brightYellow: "#e6d08a",
  brightBlue: "#b8c4ff",
  brightMagenta: "#d8ccff",
  brightCyan: "#9ad9ef",
  brightWhite: "#ffffff",
};

function clampTerminalHeight(height: number): number {
  const max = Math.floor(window.innerHeight * MAX_TERMINAL_HEIGHT_RATIO);
  return Math.min(max, Math.max(MIN_TERMINAL_HEIGHT, Math.round(height)));
}

function readStoredTerminalHeight(): number {
  try {
    const saved = localStorage.getItem(TERMINAL_HEIGHT_KEY);
    if (saved) return clampTerminalHeight(Number(saved));
  } catch {
    /* ignore */
  }
  return DEFAULT_TERMINAL_HEIGHT;
}

type TerminalPaneProps = {
  sessionId: string;
  active: boolean;
  onRegister: (sessionId: string, term: Terminal, fit: FitAddon) => void;
  onUnregister: (sessionId: string) => void;
};

function TerminalPane({
  sessionId,
  active,
  onRegister,
  onUnregister,
}: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 5000,
      theme: VOID_TERMINAL_THEME,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    term.onData((data) => {
      void window.voidscribe.terminalWrite(sessionId, data);
    });

    onRegister(sessionId, term, fit);

    return () => {
      onUnregister(sessionId);
      term.dispose();
    };
  }, [sessionId, onRegister, onUnregister]);

  return (
    <div
      className={`terminal-panel__pane${active ? " terminal-panel__pane--active" : ""}`}
      aria-hidden={!active}
    >
      <div ref={hostRef} className="terminal-panel__xterm" />
    </div>
  );
}

export const WorkspaceConsole = forwardRef<
  WorkspaceConsoleHandle,
  WorkspaceConsoleProps
>(function WorkspaceConsole({ workspacePath, onClose, onEmpty }, ref) {
  const [panelHeight, setPanelHeight] = useState(readStoredTerminalHeight);
  const [resizing, setResizing] = useState(false);
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bootError, setBootError] = useState("");
  const [panelTab, setPanelTab] = useState<
    (typeof PANEL_TABS)[number]["id"]
  >("terminal");

  const panelHeightRef = useRef(panelHeight);
  const workspaceRef = useRef(workspacePath);
  const activeIdRef = useRef(activeId);
  const panesRef = useRef(
    new Map<string, { term: Terminal; fit: FitAddon }>()
  );

  panelHeightRef.current = panelHeight;
  workspaceRef.current = workspacePath;
  activeIdRef.current = activeId;

  const applySessionList = useCallback(
    (list: { sessions: TerminalSessionInfo[]; activeId: string | null }) => {
      setSessions(list.sessions);
      setActiveId(list.activeId);
      if (list.sessions.length === 0) {
        onEmpty();
      }
    },
    [onEmpty]
  );

  const fitActiveTerminal = useCallback(() => {
    const id = activeIdRef.current;
    if (!id) return;
    const pane = panesRef.current.get(id);
    if (!pane) return;

    try {
      pane.fit.fit();
      const dims = pane.fit.proposeDimensions();
      if (dims && dims.cols > 0 && dims.rows > 0) {
        void window.voidscribe.terminalResize(id, dims.cols, dims.rows);
      }
      pane.term.focus();
    } catch {
      /* ignore */
    }
  }, []);

  const registerPane = useCallback(
    (sessionId: string, term: Terminal, fit: FitAddon) => {
      panesRef.current.set(sessionId, { term, fit });
      if (sessionId === activeIdRef.current) {
        requestAnimationFrame(() => fitActiveTerminal());
      }
    },
    [fitActiveTerminal]
  );

  const unregisterPane = useCallback((sessionId: string) => {
    panesRef.current.delete(sessionId);
  }, []);

  useImperativeHandle(ref, () => ({
    handleActivity(activity: AgentActivity) {
      const id = activeIdRef.current;
      const term = id ? panesRef.current.get(id)?.term : null;
      if (!term) return;

      switch (activity.type) {
        case "tool_start":
          term.writeln(
            `\x1b[38;2;75;175;110m▶ ${formatToolActivity(activity.name, activity.detail)}\x1b[0m`
          );
          break;
        case "tool_done":
          term.writeln(
            `\x1b[38;2;75;175;110m✓ ${formatToolActivity(activity.name, activity.detail)}\x1b[0m`
          );
          break;
        case "console_command":
          term.writeln(`\x1b[90m[agent]\x1b[0m ${activity.command}`);
          break;
        case "console_output":
          if (activity.stream === "stderr") {
            term.writeln(`\x1b[38;2;232;160;160m${activity.text}\x1b[0m`);
          } else {
            term.write(`${activity.text}\r\n`);
          }
          break;
        default:
          break;
      }
    },
    writeln(text: string) {
      const id = activeIdRef.current;
      panesRef.current.get(id ?? "")?.term.writeln(text);
    },
    focus() {
      fitActiveTerminal();
    },
  }));

  useEffect(() => {
    const removeData = window.voidscribe.onTerminalData(({ sessionId, data }) => {
      panesRef.current.get(sessionId)?.term.write(data);
    });

    const removeExit = window.voidscribe.onTerminalExit(
      ({ sessionId, exitCode }) => {
        panesRef.current
          .get(sessionId)
          ?.term.writeln(`\r\n\x1b[90m[сессия завершена: ${exitCode}]\x1b[0m`);
        setSessions((prev) =>
          prev.map((item) =>
            item.id === sessionId ? { ...item, alive: false } : item
          )
        );
      }
    );

    return () => {
      removeData();
      removeExit();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const cwd = workspaceRef.current.trim();
      if (!cwd) {
        setBootError("Выберите папку проекта слева.");
        onEmpty();
        return;
      }

      setBootError("");
      const list = await window.voidscribe.terminalList();
      if (cancelled) return;

      if (list.sessions.length === 0) {
        const created = await window.voidscribe.terminalCreate(cwd);
        if (cancelled) return;

        if (!created.ok) {
          setBootError(created.error);
          onEmpty();
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
  }, [workspacePath, onEmpty, fitActiveTerminal]);

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

  async function handleNewTerminal() {
    const cwd = workspacePath.trim();
    if (!cwd) {
      setBootError("Выберите папку проекта слева.");
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
    setActiveId(id);
    setPanelTab("terminal");
  }

  async function handleKillSession(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    const list = await window.voidscribe.terminalKill(id);
    panesRef.current.delete(id);
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
      const next = clampTerminalHeight(
        startHeight - (moveEvent.clientY - startY)
      );
      panelHeightRef.current = next;
      setPanelHeight(next);
    };

    const onUp = (upEvent: PointerEvent) => {
      try {
        handle.releasePointerCapture(upEvent.pointerId);
      } catch {
        /* ignore */
      }
      setResizing(false);
      document.body.classList.remove("terminal-panel--resizing-body");
      try {
        localStorage.setItem(
          TERMINAL_HEIGHT_KEY,
          String(panelHeightRef.current)
        );
      } catch {
        /* ignore */
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

  return (
    <section
      className={`terminal-panel terminal-panel--open${resizing ? " terminal-panel--resizing" : ""}`}
      style={{ height: panelHeight }}
      aria-label="Терминал"
    >
      <div
        className="terminal-panel__resize-handle"
        onPointerDown={handleResizePointerDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Изменить высоту терминала"
      />

      {panelTab === "terminal" ? (
        <div className="terminal-panel__workspace">
          <div
            className="terminal-panel__main"
            onClick={() => fitActiveTerminal()}
          >
            {sessions.map((session) => (
              <TerminalPane
                key={session.id}
                sessionId={session.id}
                active={session.id === activeId}
                onRegister={registerPane}
                onUnregister={unregisterPane}
              />
            ))}
          </div>

          <aside
            className="terminal-panel__sidebar"
            aria-label="Список терминалов"
          >
            {sessions.map((session) => {
              const isActive = session.id === activeId;
              return (
                <div
                  key={session.id}
                  className={`terminal-panel__session-row${isActive ? " terminal-panel__session-row--active" : ""}`}
                >
                  <button
                    type="button"
                    className={`terminal-panel__session${isActive ? " terminal-panel__session--active" : ""}${session.alive ? "" : " terminal-panel__session--dead"}`}
                    onClick={() => void handleSelectSession(session.id)}
                    title={session.title}
                  >
                    <span
                      className="terminal-panel__session-bar"
                      aria-hidden
                    />
                    <svg
                      className="terminal-panel__session-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="3" y="4" width="18" height="14" rx="2" />
                      <path d="M7 8h6M7 12h10" />
                    </svg>
                    <span className="terminal-panel__session-label">
                      {session.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="terminal-panel__session-kill"
                    onClick={(event) => void handleKillSession(session.id, event)}
                    aria-label={`Закрыть ${session.title}`}
                    title="Закрыть терминал"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </aside>
        </div>
      ) : (
        <div className="terminal-panel__placeholder">
          <p>Раздел скоро будет доступен.</p>
        </div>
      )}

      <footer className="terminal-panel__tabbar">
        {PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`terminal-panel__tab${panelTab === tab.id ? " terminal-panel__tab--active" : ""}`}
            disabled={!tab.enabled}
            onClick={() => tab.enabled && setPanelTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}

        <div className="terminal-panel__tabbar-spacer" />

        {bootError ? (
          <span className="terminal-panel__error" title={bootError}>
            {bootError}
          </span>
        ) : null}

        <button
          type="button"
          className="terminal-panel__tool-btn"
          onClick={() => void handleNewTerminal()}
          aria-label="Новый терминал"
          title="Новый терминал"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <button
          type="button"
          className="terminal-panel__tool-btn"
          onClick={onClose}
          aria-label="Скрыть терминал"
          title="Скрыть терминал"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </footer>
    </section>
  );
});
