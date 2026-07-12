import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import type { BrowserWindow } from "electron";
import type { IPty } from "node-pty";

type ShellMode = "pty" | "pipe" | "mirror";

export type TerminalSessionInfo = {
  id: string;
  title: string;
  cwd: string;
  alive: boolean;
  mirror?: boolean;
};

type TerminalSession = TerminalSessionInfo & {
  shellMode: ShellMode;
  pty: IPty | null;
  pipeChild: ChildProcess | null;
};

let boundWindow: BrowserWindow | null = null;
const sessions = new Map<string, TerminalSession>();
let activeSessionId: string | null = null;
let sessionCounter = 0;
let agentMirrorSessionId: string | null = null;

export function bindPtyWindow(win: BrowserWindow): void {
  boundWindow = win;
}

function send(channel: string, payload?: unknown): void {
  if (!boundWindow || boundWindow.isDestroyed()) return;
  boundWindow.webContents.send(channel, payload);
}

function shellLabel(): string {
  sessionCounter += 1;
  return `Terminal ${sessionCounter}`;
}

function toInfo(session: TerminalSession): TerminalSessionInfo {
  return {
    id: session.id,
    title: session.title,
    cwd: session.cwd,
    alive: session.alive,
    mirror: session.shellMode === "mirror" ? true : undefined,
  };
}

function broadcastSessions(): void {
  send("terminal:updated", listSessions());
}

function spawnNativeShell(
  session: TerminalSession
): { ok: true } | { ok: false; error: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require("node-pty") as typeof import("node-pty");

  const shell =
    process.platform === "win32"
      ? "powershell.exe"
      : process.env.SHELL || "/bin/bash";

  const args = process.platform === "win32" ? ["-NoLogo"] : ["-l"];

  session.pty = pty.spawn(shell, args, {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: session.cwd,
    env: process.env as Record<string, string>,
    useConpty: process.platform === "win32",
  });
  session.shellMode = "pty";

  session.pty.onData((data) => {
    send("terminal:data", { sessionId: session.id, data });
  });

  session.pty.onExit(({ exitCode }) => {
    session.alive = false;
    session.pty = null;
    send("terminal:exit", { sessionId: session.id, exitCode });
  });

  return { ok: true };
}

function spawnPipeShell(
  session: TerminalSession
): { ok: true } | { ok: false; error: string } {
  const shell =
    process.platform === "win32"
      ? "powershell.exe"
      : process.env.SHELL || "/bin/bash";

  const args =
    process.platform === "win32" ? ["-NoLogo", "-NoExit"] : ["-l"];

  try {
    const child = spawn(shell, args, {
      cwd: session.cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    session.pipeChild = child;
    session.shellMode = "pipe";

    child.stdout?.on("data", (chunk: Buffer) => {
      send("terminal:data", {
        sessionId: session.id,
        data: chunk.toString("utf8"),
      });
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      send("terminal:data", {
        sessionId: session.id,
        data: chunk.toString("utf8"),
      });
    });

    child.on("exit", (exitCode) => {
      session.alive = false;
      session.pipeChild = null;
      send("terminal:exit", {
        sessionId: session.id,
        exitCode: exitCode ?? 0,
      });
    });

    child.on("error", (err) => {
      send("terminal:data", {
        sessionId: session.id,
        data: `\r\n\x1b[38;2;232;160;160m${err.message}\x1b[0m\r\n`,
      });
    });

    return { ok: true };
  } catch (err) {
    session.pipeChild = null;
    session.shellMode = "pipe";
    const message =
      err instanceof Error ? err.message : "Не удалось запустить терминал.";
    return { ok: false, error: message };
  }
}

function bootSession(
  session: TerminalSession
): { ok: true } | { ok: false; error: string } {
  try {
    return spawnNativeShell(session);
  } catch (err) {
    console.warn(
      "[terminal] node-pty unavailable, using pipe fallback:",
      err instanceof Error ? err.message : err
    );
    return spawnPipeShell(session);
  }
}

export function listSessions(): {
  sessions: TerminalSessionInfo[];
  activeId: string | null;
} {
  return {
    sessions: Array.from(sessions.values()).map(toInfo),
    activeId: activeSessionId,
  };
}

export function createSession(
  cwd: string
): { ok: true; session: TerminalSessionInfo } | { ok: false; error: string } {
  const nextCwd = cwd.trim();
  if (!nextCwd) {
    return { ok: false, error: "Сначала выберите папку проекта." };
  }

  const id = randomUUID();
  const session: TerminalSession = {
    id,
    title: shellLabel(),
    cwd: nextCwd,
    alive: true,
    shellMode: "pipe",
    pty: null,
    pipeChild: null,
  };

  const result = bootSession(session);
  if (!result.ok) {
    return result;
  }

  sessions.set(id, session);
  activeSessionId = id;
  broadcastSessions();
  return { ok: true, session: toInfo(session) };
}

export function ensureAgentMirrorSession(
  cwd: string
): { ok: true; sessionId: string } | { ok: false; error: string } {
  const nextCwd = cwd.trim();
  if (!nextCwd) {
    return { ok: false, error: "Сначала выберите папку проекта." };
  }

  const existing =
    agentMirrorSessionId && sessions.get(agentMirrorSessionId)
      ? sessions.get(agentMirrorSessionId)!
      : null;

  if (existing) {
    existing.cwd = nextCwd;
    activeSessionId = existing.id;
    broadcastSessions();
    return { ok: true, sessionId: existing.id };
  }

  const id = randomUUID();
  const session: TerminalSession = {
    id,
    title: "Agent",
    cwd: nextCwd,
    alive: true,
    shellMode: "mirror",
    pty: null,
    pipeChild: null,
  };

  sessions.set(id, session);
  agentMirrorSessionId = id;
  activeSessionId = id;
  broadcastSessions();
  return { ok: true, sessionId: id };
}

export function appendMirrorOutput(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (!session || session.shellMode !== "mirror" || !session.alive) return;
  send("terminal:data", { sessionId, data });
}

export function selectSession(id: string): boolean {
  if (!sessions.has(id)) return false;
  activeSessionId = id;
  broadcastSessions();
  return true;
}

export function writePty(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (!session || !session.alive || session.shellMode === "mirror") return;

  if (session.shellMode === "pty") {
    session.pty?.write(data);
    return;
  }

  if (
    session.pipeChild?.stdin &&
    !session.pipeChild.stdin.destroyed
  ) {
    session.pipeChild.stdin.write(data);
  }
}

export function resizePty(
  sessionId: string,
  cols: number,
  rows: number
): void {
  const session = sessions.get(sessionId);
  if (!session || session.shellMode !== "pty" || !session.pty) return;

  const safeCols = Math.max(2, Math.floor(cols));
  const safeRows = Math.max(1, Math.floor(rows));
  session.pty.resize(safeCols, safeRows);
}

export function killSession(id: string): {
  sessions: TerminalSessionInfo[];
  activeId: string | null;
} {
  const session = sessions.get(id);
  if (!session) return listSessions();

  if (session.pty) {
    try {
      session.pty.kill();
    } catch {
      /* ignore */
    }
  }

  if (session.pipeChild) {
    try {
      session.pipeChild.kill();
    } catch {
      /* ignore */
    }
  }

  if (agentMirrorSessionId === id) {
    agentMirrorSessionId = null;
  }

  sessions.delete(id);

  if (activeSessionId === id) {
    const remaining = sessions.keys().next().value as string | undefined;
    activeSessionId = remaining ?? null;
  }

  broadcastSessions();
  return listSessions();
}

export function stopPty(): void {
  for (const id of Array.from(sessions.keys())) {
    killSession(id);
  }
  activeSessionId = null;
  agentMirrorSessionId = null;
}

export function getActiveSessionId(): string | null {
  return activeSessionId;
}
