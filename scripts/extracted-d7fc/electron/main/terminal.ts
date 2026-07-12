import { spawn } from "child_process";
import { WorkspaceError, assertWorkspaceRoot } from "./workspace";

const COMMAND_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_CHARS = 32_000;

export type TerminalRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

function trimOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n… (вывод обрезан)`;
}

export async function runWorkspaceCommand(
  workspaceRoot: string,
  command: string
): Promise<TerminalRunResult> {
  const cwd = assertWorkspaceRoot(workspaceRoot);
  const trimmed = command.trim();

  if (!trimmed) {
    throw new WorkspaceError("Введите команду.");
  }

  const isWin = process.platform === "win32";
  const shell = isWin ? "powershell.exe" : "/bin/bash";
  const args = isWin ? ["-NoProfile", "-Command", trimmed] : ["-lc", trimmed];

  return new Promise((resolvePromise, reject) => {
    const child = spawn(shell, args, {
      cwd,
      env: process.env,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new WorkspaceError("Команда превысила лимит времени (120 с)."));
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        exitCode: code,
      });
    });
  });
}
