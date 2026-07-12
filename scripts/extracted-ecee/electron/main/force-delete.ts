import { execFile } from "child_process";
import { promisify } from "util";
import { rename, rm, stat, unlink } from "fs/promises";
import { dirname, join } from "path";
import { resolveShellExecutable, shellSpawnEnv } from "./shell-env";
import {
  WorkspaceError,
  isWorkspaceFsLockError,
  isWorkspaceFsMissingError,
  resolveWorkspacePath,
} from "./workspace";

const execFileAsync = promisify(execFile);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

async function pathExists(fullPath: string): Promise<boolean> {
  try {
    await stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function killProcessesLockingPath(
  workspaceRoot: string,
  targetFull: string
): Promise<void> {
  if (process.platform !== "win32") return;

  const rootLit = escapePowerShellLiteral(workspaceRoot);
  const targetLit = escapePowerShellLiteral(targetFull);
  const ps = [
    "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |",
    "Where-Object {",
    "  $_.Name -in @('node.exe','npm.exe','npx.exe','cmd.exe','powershell.exe') -and",
    `  ($_.CommandLine -like '*${rootLit}*' -or $_.CommandLine -like '*${targetLit}*')`,
    "} |",
    "ForEach-Object {",
    "  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
    "}",
  ].join(" ");

  try {
    await execFileAsync(
      resolveShellExecutable(),
      ["-NoProfile", "-Command", ps],
      { windowsHide: true, env: shellSpawnEnv(), timeout: 20_000 }
    );
  } catch {
    /* ignore */
  }

  await sleep(400);
}

async function shellForceRemove(
  fullPath: string,
  isDirectory: boolean
): Promise<void> {
  const lit = escapePowerShellLiteral(fullPath);

  if (process.platform === "win32") {
    const ps = isDirectory
      ? `Remove-Item -LiteralPath '${lit}' -Force -Recurse -ErrorAction Stop`
      : `Remove-Item -LiteralPath '${lit}' -Force -ErrorAction Stop`;
    await execFileAsync(
      resolveShellExecutable(),
      ["-NoProfile", "-Command", ps],
      { windowsHide: true, env: shellSpawnEnv(), timeout: 180_000 }
    );
    return;
  }

  await rm(fullPath, {
    recursive: isDirectory,
    force: true,
    maxRetries: 5,
    retryDelay: 300,
  });
}

async function renameAwayForDelete(fullPath: string): Promise<void> {
  const parent = dirname(fullPath);
  const trashDir = join(parent, `.voidscribe-trash-${Date.now()}`);
  await rename(fullPath, trashDir);
  if (!(await pathExists(trashDir))) return;

  try {
    await shellForceRemove(trashDir, true);
  } catch {
    /* may delete after handles release */
  }
}

export async function forceDeleteWorkspaceEntry(
  workspaceRoot: string,
  targetPath: string
): Promise<void> {
  const normalized = targetPath.replace(/\\/g, "/");
  if (!normalized || normalized === ".") {
    throw new WorkspaceError("Нельзя удалить корень проекта.");
  }

  const full = resolveWorkspacePath(workspaceRoot, normalized);
  let isDirectory = false;

  try {
    const info = await stat(full);
    isDirectory = info.isDirectory();
  } catch (err) {
    if (isWorkspaceFsMissingError(err)) return;
    throw err;
  }

  await killProcessesLockingPath(workspaceRoot, full);

  const tryNativeDelete = async () => {
    if (isDirectory) {
      await rm(full, {
        recursive: true,
        force: true,
        maxRetries: 2,
        retryDelay: 100,
      });
    } else {
      await unlink(full);
    }
  };

  try {
    await tryNativeDelete();
    return;
  } catch (err) {
    if (isWorkspaceFsMissingError(err)) return;
    if (!isWorkspaceFsLockError(err)) throw err;
  }

  await killProcessesLockingPath(workspaceRoot, full);

  try {
    await shellForceRemove(full, isDirectory);
    if (!(await pathExists(full))) return;
  } catch {
    /* rename fallback */
  }

  if (!(await pathExists(full))) return;

  try {
    await renameAwayForDelete(full);
    return;
  } catch (err) {
    if (!(await pathExists(full))) return;
    throw err;
  }
}
