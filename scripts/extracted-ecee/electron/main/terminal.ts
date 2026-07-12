import { spawn, type ChildProcess } from "child_process";
import {
  resolveShellExecutable,
  shellSpawnEnv,
  isShellSpawnEnoent,
  shellSpawnEnoentMessage,
} from "./shell-env";
import {
  WorkspaceError,
  assertWorkspaceRoot,
  resolveWorkspacePath,
} from "./workspace";

const COMMAND_TIMEOUT_MS = 300_000;
const MAX_OUTPUT_CHARS = 32_000;

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
    } catch {
      /* ignore */
    }
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

export function cancelActiveWorkspaceCommand(): boolean {
  const current = activeCommand;
  if (!current) return false;

  current.cancelled = true;
  killProcessTree(current.child);
  return true;
}

export function hasActiveWorkspaceCommand(): boolean {
  return activeCommand !== null;
}

function trimOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n… (вывод обрезан)`;
}

function prepareCommandForShell(command: string, isWin: boolean): string {
  if (!isWin) return command;
  return command.replace(/\s&&\s/g, "; ");
}

export async function runWorkspaceCommand(
  workspaceRoot: string,
  command: string,
  relativeCwd = ".",
  options?: TerminalRunOptions
): Promise<TerminalRunResult> {
  const trimmed = command.trim();

  if (!trimmed) {
    throw new WorkspaceError("Введите команду.");
  }

  const cwd =
    relativeCwd.trim() && relativeCwd.trim() !== "."
      ? resolveWorkspacePath(workspaceRoot, relativeCwd.trim())
      : assertWorkspaceRoot(workspaceRoot);

  const isWin = process.platform === "win32";
  const shell = resolveShellExecutable();
  const prepared = prepareCommandForShell(trimmed, isWin);
  const args = isWin ? ["-NoProfile", "-Command", prepared] : ["-lc", prepared];

  return new Promise((resolvePromise, reject) => {
    const child = spawn(shell, args, {
      cwd,
      env: shellSpawnEnv(),
      windowsHide: true,
      detached: !isWin,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const commandState: ActiveCommand = { child, cancelled: false };
    activeCommand = commandState;

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (
      result:
        | { ok: true; value: TerminalRunResult }
        | { ok: false; error: unknown }
    ) => {
      if (settled) return;
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
      cancelCommand(
        new WorkspaceError("Команда превысила лимит времени (5 мин).")
      );
    }, COMMAND_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      options?.onStdout?.(text);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      options?.onStderr?.(text);
    });

    child.on("error", (err) => {
      if (isShellSpawnEnoent(err)) {
        finish({ ok: false, error: new WorkspaceError(shellSpawnEnoentMessage()) });
        return;
      }
      finish({ ok: false, error: err });
    });

    child.on("close", (code) => {
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
