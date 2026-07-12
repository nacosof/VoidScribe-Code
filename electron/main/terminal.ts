import { spawn, execSync, type ChildProcess } from "child_process";
import { resolveShellExecutable, shellSpawnEnv, isShellSpawnEnoent, shellSpawnEnoentMessage, } from "./shell-env";
import { WorkspaceError, assertWorkspaceRoot, resolveWorkspacePath, } from "./workspace";
import { isProductionBuildCommand } from "./build-diagnostics";
import { formatDevServerPreviewNote, isDevServerCommand } from "./npm-project-cwd";

export { isDevServerCommand } from "./npm-project-cwd";
const COMMAND_TIMEOUT_MS = 300000;
const DEV_SERVER_PROBE_MS = 90000;
const MAX_OUTPUT_CHARS = 32000;
const DEV_BUILD_FAILED_RE = /build error|failed to compile|compilation failed|error TS\d+|unable to decode|processing image failed|module not found|cannot find module|ELIFECYCLE|turbopack build failed|invalid next\.config|couldn't find the next\.js package|port \d+ is in use|eaddrinuse|error when starting dev server|command not found|ENOENT/i;
const DEV_SERVER_READY_RE = /ready in [\d.]+(?:ms|s)?|✓\s*ready|\bVITE\b[^\n]*\bready\b|compiled successfully|started server on|(?:local|network):\s*https?:\/\/|https?:\/\/(?:localhost|127\.0\.0\.1):\d+|listening on|➜\s*Local:/i;
export type TerminalRunResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    cwd: string;
};
export type TerminalRunOptions = {
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    signal?: AbortSignal;
};
type ActiveCommand = {
    child: ChildProcess;
    cancelled: boolean;
};
let activeCommand: ActiveCommand | null = null;
function killProcessTree(child: ChildProcess): void {
    const pid = child.pid;
    if (!pid) {
        try {
            child.kill("SIGKILL");
        }
        catch {
        }
        return;
    }
    if (process.platform === "win32") {
        try {
            execSync(`taskkill /PID ${pid} /T /F`, {
                windowsHide: true,
                stdio: "ignore",
                timeout: 10000,
            });
        }
        catch {
            try {
                child.kill("SIGKILL");
            }
            catch {
            }
        }
        return;
    }
    try {
        process.kill(-pid, "SIGTERM");
    }
    catch {
        try {
            child.kill("SIGTERM");
        }
        catch {
        }
    }
}
export function cancelActiveWorkspaceCommand(): boolean {
    const current = activeCommand;
    if (!current)
        return false;
    current.cancelled = true;
    killProcessTree(current.child);
    return true;
}
export function hasActiveWorkspaceCommand(): boolean {
    return activeCommand !== null;
}
function trimOutput(text: string): string {
    if (text.length <= MAX_OUTPUT_CHARS)
        return text;
    return `${text.slice(0, MAX_OUTPUT_CHARS)}\n… (вывод обрезан)`;
}
function prepareCommandForShell(command: string, isWin: boolean): string {
    if (!isWin)
        return command;
    return command.replace(/\s&&\s/g, "; ");
}
function prepareDevServerCommand(command: string, isWin: boolean): string {
    const prepared = prepareCommandForShell(command, isWin);
    if (isWin) {
        return `$env:BROWSER='none'; $env:CI='true'; ${prepared}`;
    }
    return `BROWSER=none CI=true ${prepared}`;
}
export async function runWorkspaceCommand(workspaceRoot: string, command: string, relativeCwd = ".", options?: TerminalRunOptions): Promise<TerminalRunResult> {
    const trimmed = command.trim();
    if (!trimmed) {
        throw new WorkspaceError("Введите команду.");
    }
    if (isDevServerCommand(trimmed)) {
        return runDevServerProbe(workspaceRoot, trimmed, relativeCwd, options);
    }
    return runWorkspaceCommandBlocking(workspaceRoot, trimmed, relativeCwd, options, COMMAND_TIMEOUT_MS);
}
type EarlyStopDecision = {
    stop: true;
    exitCode: number;
    note: string | null;
} | {
    stop: "defer";
    deferMs: number;
    exitCode: number;
    note: string | null;
};
async function runDevServerProbe(workspaceRoot: string, command: string, relativeCwd: string, options?: TerminalRunOptions): Promise<TerminalRunResult> {
    const isWin = process.platform === "win32";
    const probeCommand = prepareDevServerCommand(command, isWin);
    return runWorkspaceCommandBlocking(workspaceRoot, probeCommand, relativeCwd, options, DEV_SERVER_PROBE_MS, (stdout, stderr) => {
        const combined = `${stdout}\n${stderr}`;
        if (DEV_BUILD_FAILED_RE.test(combined)) {
            return { stop: true, exitCode: 1, note: null };
        }
        if (DEV_SERVER_READY_RE.test(combined)) {
            const previewNote = formatDevServerPreviewNote(combined, relativeCwd);
            return {
                stop: "defer",
                deferMs: 4500,
                exitCode: 0,
                note: previewNote ||
                    "\n[VoidScribe] Dev-сервер запустился — процесс остановлен, чтобы агент продолжил работу. " +
                    "Сообщи пользователю URL из вывода (Local: http://localhost:…). " +
                    "Проверка сборки без долгого ожидания: npm run build.",
            };
        }
        return null;
    });
}
async function runWorkspaceCommandBlocking(workspaceRoot: string, command: string, relativeCwd: string, options: TerminalRunOptions | undefined, timeoutMs: number, onOutput?: (stdout: string, stderr: string) => EarlyStopDecision | null): Promise<TerminalRunResult> {
    const trimmed = command.trim();
    const cwd = relativeCwd.trim() && relativeCwd.trim() !== "."
        ? resolveWorkspacePath(workspaceRoot, relativeCwd.trim())
        : assertWorkspaceRoot(workspaceRoot);
    const isWin = process.platform === "win32";
    const shell = resolveShellExecutable();
    const prepared = prepareCommandForShell(trimmed, isWin);
    const psCommand = isWin
        ? `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); $OutputEncoding = [Console]::OutputEncoding; ${prepared}`
        : prepared;
    const args = isWin ? ["-NoProfile", "-Command", psCommand] : ["-lc", prepared];
    return new Promise((resolvePromise, reject) => {
        const spawnEnv = shellSpawnEnv();
        if (isProductionBuildCommand(trimmed)) {
            spawnEnv.NODE_ENV = "production";
        }
        const child = spawn(shell, args, {
            cwd,
            env: spawnEnv,
            windowsHide: true,
            detached: !isWin,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const commandState: ActiveCommand = { child, cancelled: false };
        activeCommand = commandState;
        let stdout = "";
        let stderr = "";
        let settled = false;
        let probeEarlyResult: TerminalRunResult | null = null;
        const finish = (result: {
            ok: true;
            value: TerminalRunResult;
        } | {
            ok: false;
            error: unknown;
        }) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (activeCommand?.child === child) {
                activeCommand = null;
            }
            options?.signal?.removeEventListener("abort", onAbort);
            if (result.ok) {
                resolvePromise(result.value);
                return;
            }
            reject(result.error);
        };
        const cancelCommand = (error: unknown) => {
            commandState.cancelled = true;
            killProcessTree(child);
            finish({ ok: false, error });
        };
        const onAbort = () => {
            cancelCommand(new DOMException("Aborted", "AbortError"));
        };
        if (options?.signal?.aborted) {
            onAbort();
            return;
        }
        options?.signal?.addEventListener("abort", onAbort);
        const timer = setTimeout(() => {
            cancelCommand(new WorkspaceError(isDevServerCommand(trimmed)
                ? "Dev-сервер не ответил за 90 сек. Проверь вывод: часто порт занят, нет node_modules или неверная папка (cwd). Попробуй npm run build или открой терминал вручную."
                : "Команда превысила лимит времени (5 мин)."));
        }, timeoutMs);
        let deferTimer: ReturnType<typeof setTimeout> | null = null;
        const applyEarlyStop = (decision: {
            exitCode: number;
            note: string | null;
        }) => {
            if (decision.note) {
                stdout += decision.note;
                options?.onStdout?.(decision.note);
            }
            probeEarlyResult = {
                stdout: trimOutput(stdout),
                stderr: trimOutput(stderr),
                exitCode: decision.exitCode,
                cwd,
            };
            killProcessTree(child);
        };
        const tryEarlyStop = () => {
            if (!onOutput || settled || probeEarlyResult)
                return;
            const decision = onOutput(stdout, stderr);
            if (!decision)
                return;
            if (decision.stop === "defer") {
                if (deferTimer)
                    return;
                deferTimer = setTimeout(() => {
                    deferTimer = null;
                    if (settled || probeEarlyResult)
                        return;
                    const recheck = onOutput!(stdout, stderr);
                    if (recheck?.stop === true && recheck.exitCode !== 0) {
                        applyEarlyStop(recheck);
                        return;
                    }
                    applyEarlyStop({
                        exitCode: decision.exitCode,
                        note: decision.note,
                    });
                }, decision.deferMs);
                return;
            }
            if (deferTimer) {
                clearTimeout(deferTimer);
                deferTimer = null;
            }
            applyEarlyStop(decision);
        };
        child.stdout?.on("data", (chunk: Buffer) => {
            const text = chunk.toString("utf8");
            stdout += text;
            options?.onStdout?.(text);
            tryEarlyStop();
        });
        child.stderr?.on("data", (chunk: Buffer) => {
            const text = chunk.toString("utf8");
            stderr += text;
            options?.onStderr?.(text);
            tryEarlyStop();
        });
        child.on("error", (err) => {
            if (isShellSpawnEnoent(err)) {
                finish({ ok: false, error: new WorkspaceError(shellSpawnEnoentMessage()) });
                return;
            }
            finish({ ok: false, error: err });
        });
        child.on("close", (code) => {
            if (settled)
                return;
            if (probeEarlyResult) {
                finish({ ok: true, value: probeEarlyResult });
                return;
            }
            if (commandState.cancelled) {
                finish({
                    ok: false,
                    error: new DOMException("Aborted", "AbortError"),
                });
                return;
            }
            finish({
                ok: true,
                value: {
                    stdout: trimOutput(stdout),
                    stderr: trimOutput(stderr),
                    exitCode: code,
                    cwd,
                },
            });
        });
    });
}
