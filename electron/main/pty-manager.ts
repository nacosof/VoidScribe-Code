import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { chmodSync, existsSync } from "fs";
import { dirname, join } from "path";
import { createRequire } from "module";
import type { BrowserWindow } from "electron";
import type { IPty } from "node-pty";
import { shellSpawnEnvForWorkspace } from "./python-env";

const require = createRequire(import.meta.url);

function ensureNodePtySpawnHelperExecutable(): void {
    if (process.platform !== "darwin")
        return;
    const arch = process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
    const helper = join(dirname(require.resolve("node-pty/package.json")), "prebuilds", arch, "spawn-helper");
    if (!existsSync(helper))
        return;
    try {
        chmodSync(helper, 0o755);
    }
    catch {
    }
}
type ShellMode = "pty" | "pipe" | "mirror";
export type TerminalSessionInfo = {
    id: string;
    title: string;
    cwd: string;
    alive: boolean;
    mirror?: boolean;
};
export type PtySessionInfo = TerminalSessionInfo;
type TerminalSession = TerminalSessionInfo & {
    shellMode: ShellMode;
    pty: IPty | null;
    pipeChild: ChildProcess | null;
    mirrorVisible?: boolean;
};
let boundWindow: BrowserWindow | null = null;
const sessions = new Map<string, TerminalSession>();
let activeSessionId: string | null = null;
let agentMirrorSessionId: string | null = null;
export function bindPtyWindow(win: BrowserWindow): void {
    boundWindow = win;
}
function send(channel: string, payload?: unknown): void {
    if (!boundWindow || boundWindow.isDestroyed())
        return;
    boundWindow.webContents.send(channel, payload);
}
/** Mirror/pipe stdout uses bare LF; xterm needs CR+LF or lines drift diagonally. */
function normalizeTerminalOutput(data: string): string {
    return data.replace(/(?<!\r)\n/g, "\r\n");
}
function shellLabel(): string {
    const activeTerminals = Array.from(sessions.values()).filter((session) => session.shellMode !== "mirror").length;
    return `Terminal ${activeTerminals + 1}`;
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
function spawnNativeShell(session: TerminalSession): {
    ok: true;
} | {
    ok: false;
    error: string;
} {
    ensureNodePtySpawnHelperExecutable();
    const pty = require("node-pty") as typeof import("node-pty");
    const shell = process.platform === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/bash";
    const args = process.platform === "win32" ? ["-NoLogo"] : ["-l"];
    session.pty = pty.spawn(shell, args, {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: session.cwd,
        env: shellSpawnEnvForWorkspace(session.cwd) as Record<string, string>,
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
function spawnPipeShell(session: TerminalSession): {
    ok: true;
} | {
    ok: false;
    error: string;
} {
    const shell = process.platform === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/bash";
    const args = process.platform === "win32" ? ["-NoLogo", "-NoExit"] : ["-l"];
    try {
        const child = spawn(shell, args, {
            cwd: session.cwd,
            env: {
                ...shellSpawnEnvForWorkspace(session.cwd),
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
                data: normalizeTerminalOutput(chunk.toString("utf8")),
            });
        });
        child.stderr?.on("data", (chunk: Buffer) => {
            send("terminal:data", {
                sessionId: session.id,
                data: normalizeTerminalOutput(chunk.toString("utf8")),
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
    }
    catch (err) {
        session.pipeChild = null;
        session.shellMode = "pipe";
        const message = err instanceof Error ? err.message : "Не удалось запустить терминал.";
        return { ok: false, error: message };
    }
}
function bootSession(session: TerminalSession): {
    ok: true;
} | {
    ok: false;
    error: string;
} {
    try {
        return spawnNativeShell(session);
    }
    catch (err) {
        console.warn("[terminal] node-pty unavailable, using pipe fallback:", err instanceof Error ? err.message : err);
        return spawnPipeShell(session);
    }
}
export function listSessions(): {
    sessions: TerminalSessionInfo[];
    activeId: string | null;
} {
    const visible = Array.from(sessions.values()).filter((session) => session.shellMode !== "mirror" || session.mirrorVisible);
    const activeVisible = activeSessionId && visible.some((session) => session.id === activeSessionId)
        ? activeSessionId
        : (visible.find((session) => session.shellMode !== "mirror")?.id ??
            visible[0]?.id ??
            null);
    return {
        sessions: visible.map(toInfo),
        activeId: activeVisible,
    };
}
export function createSession(cwd: string): {
    ok: true;
    session: TerminalSessionInfo;
} | {
    ok: false;
    error: string;
} {
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
export const AGENT_MIRROR_TITLE = "VoidScribe";
function ensureMirrorSession(cwd: string): {
    ok: true;
    sessionId: string;
} | {
    ok: false;
    error: string;
} {
    const nextCwd = cwd.trim();
    if (!nextCwd) {
        return { ok: false, error: "Сначала выберите папку проекта." };
    }
    const existing = agentMirrorSessionId && sessions.get(agentMirrorSessionId)
        ? sessions.get(agentMirrorSessionId)!
        : null;
    if (existing) {
        existing.cwd = nextCwd;
        if (existing.mirrorVisible) {
            activeSessionId = existing.id;
            broadcastSessions();
        }
        return { ok: true, sessionId: existing.id };
    }
    const id = randomUUID();
    const session: TerminalSession = {
        id,
        title: AGENT_MIRROR_TITLE,
        cwd: nextCwd,
        alive: true,
        shellMode: "mirror",
        mirrorVisible: false,
        pty: null,
        pipeChild: null,
    };
    sessions.set(id, session);
    agentMirrorSessionId = id;
    return { ok: true, sessionId: id };
}
function revealMirrorSession(session: TerminalSession): void {
    if (session.mirrorVisible)
        return;
    session.mirrorVisible = true;
    activeSessionId = session.id;
    broadcastSessions();
}
export function appendMirrorOutput(sessionId: string, data: string): void {
    const session = sessions.get(sessionId);
    if (!session || session.shellMode !== "mirror" || !session.alive)
        return;
    if (!session.mirrorVisible) {
        revealMirrorSession(session);
    }
    send("terminal:data", { sessionId, data: normalizeTerminalOutput(data) });
}
export function ensureAgentMirrorSession(workspaceRoot: string): PtySessionInfo {
    const result = ensureMirrorSession(workspaceRoot);
    if (!result.ok) {
        return {
            id: "",
            title: AGENT_MIRROR_TITLE,
            cwd: workspaceRoot,
            alive: false,
        };
    }
    const session = sessions.get(result.sessionId);
    if (session) {
        revealMirrorSession(session);
    }
    return session ? toInfo(session) : { id: result.sessionId, title: AGENT_MIRROR_TITLE, cwd: workspaceRoot, alive: true };
}
export function getAgentMirrorSessionId(): string | null {
    return agentMirrorSessionId;
}
export function appendMirrorOutputForWorkspace(workspaceRoot: string, data: string): void {
    const result = ensureMirrorSession(workspaceRoot);
    if (result.ok)
        appendMirrorOutput(result.sessionId, data);
}
export function selectSession(id: string): boolean {
    if (!sessions.has(id))
        return false;
    activeSessionId = id;
    broadcastSessions();
    return true;
}
export function writePty(sessionId: string, data: string): void {
    const session = sessions.get(sessionId);
    if (!session || !session.alive || session.shellMode === "mirror")
        return;
    if (session.shellMode === "pty") {
        session.pty?.write(data);
        return;
    }
    if (session.pipeChild?.stdin && !session.pipeChild.stdin.destroyed) {
        session.pipeChild.stdin.write(data);
    }
}
export function resizePty(sessionId: string, cols: number, rows: number): void {
    const session = sessions.get(sessionId);
    if (!session || session.shellMode !== "pty" || !session.pty)
        return;
    const safeCols = Math.max(2, Math.floor(cols));
    const safeRows = Math.max(1, Math.floor(rows));
    session.pty.resize(safeCols, safeRows);
}
export function killSession(id: string): {
    sessions: TerminalSessionInfo[];
    activeId: string | null;
} {
    const session = sessions.get(id);
    if (!session)
        return listSessions();
    if (session.pty) {
        try {
            session.pty.kill();
        }
        catch {
        }
    }
    if (session.pipeChild) {
        try {
            session.pipeChild.kill();
        }
        catch {
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
export function listPtySessions(): PtySessionInfo[] {
    return listSessions().sessions;
}
export function createPtySession(workspaceRoot: string): {
    ok: true;
    session: PtySessionInfo;
} | {
    ok: false;
    error: string;
} {
    return createSession(workspaceRoot);
}
export function writePtySession(id: string, data: string): boolean {
    writePty(id, data);
    return true;
}
export function resizePtySession(id: string, cols: number, rows: number): boolean {
    resizePty(id, cols, rows);
    return true;
}
export function killPtySession(id: string): boolean {
    killSession(id);
    return true;
}
