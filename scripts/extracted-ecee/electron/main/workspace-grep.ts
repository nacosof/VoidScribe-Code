import { readdir, readFile, stat } from "fs/promises";
import { join, relative, sep } from "path";
import {
  assertWorkspaceRoot,
  resolveWorkspacePath,
  WorkspaceError,
} from "./workspace";

const IGNORE_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
  "coverage",
  ".turbo",
  ".cache",
  ".vscode",
  ".idea",
]);

const MAX_GREP_FILE_BYTES = 512 * 1024;
const DEFAULT_MAX_RESULTS = 200;

function normalizeRelPath(workspaceRoot: string, fullPath: string): string {
  const root = assertWorkspaceRoot(workspaceRoot);
  return relative(root, fullPath).split(sep).join("/");
}

function matchesGlob(relPath: string, glob?: string): boolean {
  if (!glob?.trim()) return true;
  const pattern = glob.trim().replace(/\\/g, "/");
  if (pattern.startsWith("*.")) {
    return relPath.endsWith(pattern.slice(1));
  }
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(relPath);
  }
  return relPath === pattern || relPath.endsWith(`/${pattern}`);
}

async function walkFiles(
  workspaceRoot: string,
  dirPath: string,
  onFile: (relPath: string, fullPath: string) => Promise<void>
): Promise<void> {
  const fullDir = resolveWorkspacePath(workspaceRoot, dirPath);
  let entries;
  try {
    entries = await readdir(fullDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (IGNORE_DIR_NAMES.has(entry.name)) continue;
      const nextDir =
        dirPath === "." ? entry.name : `${dirPath}/${entry.name}`.replace(/\\/g, "/");
      await walkFiles(workspaceRoot, nextDir, onFile);
      continue;
    }
    if (!entry.isFile()) continue;

    const relPath =
      dirPath === "."
        ? entry.name
        : `${dirPath}/${entry.name}`.replace(/\\/g, "/");
    const fullPath = join(fullDir, entry.name);
    await onFile(relPath, fullPath);
  }
}

export async function grepWorkspace(
  workspaceRoot: string,
  pattern: string,
  options?: { path?: string; glob?: string; maxResults?: number }
): Promise<string> {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    throw new WorkspaceError("Укажите pattern (regex).");
  }

  let regex: RegExp;
  try {
    regex = new RegExp(trimmedPattern, "gm");
  } catch {
    throw new WorkspaceError(`Некорректный regex: ${trimmedPattern}`);
  }

  const startPath = (options?.path ?? ".").trim() || ".";
  const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
  const matches: string[] = [];
  let filesScanned = 0;
  let truncated = false;

  await walkFiles(workspaceRoot, startPath, async (relPath, fullPath) => {
    if (truncated) return;
    if (!matchesGlob(relPath, options?.glob)) return;

    let fileStat;
    try {
      fileStat = await stat(fullPath);
    } catch {
      return;
    }
    if (!fileStat.isFile() || fileStat.size > MAX_GREP_FILE_BYTES) return;

    let content: string;
    try {
      content = await readFile(fullPath, "utf8");
    } catch {
      return;
    }

    filesScanned += 1;
    const lines = content.split(/\r?\n/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (truncated) break;
      const line = lines[lineIndex]!;
      regex.lastIndex = 0;
      const match = regex.exec(line);
      if (!match) continue;

      const lineNo = lineIndex + 1;
      const column = match.index + 1;
      matches.push(`${relPath}:${lineNo}:${column}: ${line.trimEnd()}`);
      if (matches.length >= maxResults) {
        truncated = true;
      }
    }
  });

  if (matches.length === 0) {
    return `Совпадений нет (pattern=${trimmedPattern}, path=${startPath}, файлов=${filesScanned}).`;
  }

  const header = truncated
    ? `Первые ${maxResults} совпадений (лимит):`
    : `${matches.length} совпадений:`;
  return `${header}\n${matches.join("\n")}`;
}
