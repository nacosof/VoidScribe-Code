import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, normalize, relative, resolve, sep } from "path";

const MAX_READ_BYTES = 512 * 1024;
const MAX_LIST_ENTRIES = 300;
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
]);

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

function assertWorkspaceRoot(workspaceRoot: string): string {
  const root = resolve(workspaceRoot.trim());
  if (!root.trim()) {
    throw new WorkspaceError("Сначала выберите папку проекта.");
  }
  return root;
}

export function resolveWorkspacePath(
  workspaceRoot: string,
  targetPath: string
): string {
  const root = assertWorkspaceRoot(workspaceRoot);
  const normalized = normalize(targetPath || ".").replace(/^(\.\.(\/|\\|$))+/, "");
  const full = resolve(root, normalized);

  if (full !== root && !full.startsWith(root + sep)) {
    throw new WorkspaceError("Путь выходит за пределы рабочей папки.");
  }

  return full;
}

export async function listWorkspaceDirectory(
  workspaceRoot: string,
  targetPath = "."
): Promise<string> {
  const full = resolveWorkspacePath(workspaceRoot, targetPath);
  const root = assertWorkspaceRoot(workspaceRoot);
  const entries = await readdir(full, { withFileTypes: true });
  const lines: string[] = [];
  const relBase = relative(root, full) || ".";

  lines.push(`${relBase === "." ? "." : relBase}/`);

  const sorted = entries
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted.slice(0, MAX_LIST_ENTRIES)) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      lines.push(`  ${entry.name}/ (пропущено)`);
      continue;
    }

    lines.push(`  ${entry.name}${entry.isDirectory() ? "/" : ""}`);
  }

  if (entries.length > MAX_LIST_ENTRIES) {
    lines.push(`  … ещё ${entries.length - MAX_LIST_ENTRIES} элементов`);
  }

  return lines.join("\n");
}

export async function readWorkspaceFile(
  workspaceRoot: string,
  targetPath: string
): Promise<string> {
  const full = resolveWorkspacePath(workspaceRoot, targetPath);
  const info = await stat(full);

  if (!info.isFile()) {
    throw new WorkspaceError("Это не файл.");
  }

  if (info.size > MAX_READ_BYTES) {
    throw new WorkspaceError(
      `Файл слишком большой (${info.size} байт). Лимит: ${MAX_READ_BYTES}.`
    );
  }

  return readFile(full, "utf8");
}

export async function writeWorkspaceFile(
  workspaceRoot: string,
  targetPath: string,
  content: string
): Promise<void> {
  const full = resolveWorkspacePath(workspaceRoot, targetPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}
