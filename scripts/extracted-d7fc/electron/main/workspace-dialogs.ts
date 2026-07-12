import { basename, dirname, relative, resolve, sep } from "path";
import type { BrowserWindow } from "electron";
import { dialog } from "electron";
import { assertWorkspaceRoot } from "./workspace";

export type OpenFileDialogResult =
  | { ok: true; workspacePath: string; relativePath: string }
  | { ok: false; error: string };

export type SaveFileDialogResult =
  | { ok: true; relativePath: string }
  | { ok: false; canceled?: boolean; error?: string };

export function resolvePickedFile(
  workspacePath: string,
  absolutePath: string
): { workspacePath: string; relativePath: string } {
  const filePath = resolve(absolutePath);
  const currentRoot = workspacePath.trim() ? resolve(workspacePath.trim()) : "";

  if (currentRoot) {
    const rel = relative(currentRoot, filePath).replace(/\\/g, "/");
    if (rel && !rel.startsWith("..") && !rel.includes(":/")) {
      return { workspacePath: currentRoot, relativePath: rel };
    }
  }

  const parent = dirname(filePath);
  return {
    workspacePath: parent,
    relativePath: basename(filePath),
  };
}

export async function pickOpenFile(
  win: BrowserWindow,
  workspacePath: string
): Promise<OpenFileDialogResult> {
  const result = await dialog.showOpenDialog(win, {
    title: "Open File",
    properties: ["openFile"],
    defaultPath: workspacePath.trim() || undefined,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, error: "canceled" };
  }

  const picked = resolvePickedFile(workspacePath, result.filePaths[0]!);
  return { ok: true, ...picked };
}

export async function pickNewTextFile(
  win: BrowserWindow,
  workspacePath: string
): Promise<SaveFileDialogResult> {
  if (!workspacePath.trim()) {
    return { ok: false, error: "Сначала выберите папку проекта." };
  }

  const root = assertWorkspaceRoot(workspacePath);
  const result = await dialog.showSaveDialog(win, {
    title: "New Text File",
    defaultPath: resolve(root, "untitled.txt"),
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  const resolved = resolvePickedFile(workspacePath, result.filePath);
  return { ok: true, relativePath: resolved.relativePath };
}

export async function pickSaveFileAs(
  win: BrowserWindow,
  workspacePath: string,
  currentRelativePath: string
): Promise<SaveFileDialogResult> {
  if (!workspacePath.trim()) {
    return { ok: false, error: "Сначала выберите папку проекта." };
  }

  const root = assertWorkspaceRoot(workspacePath);
  const result = await dialog.showSaveDialog(win, {
    title: "Save As",
    defaultPath: resolve(root, basename(currentRelativePath) || "untitled.txt"),
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  const filePath = resolve(result.filePath);
  const rel = relative(root, filePath).replace(/\\/g, "/");
  if (!rel || rel.startsWith("..") || rel.includes(":/")) {
    return { ok: false, error: "Файл должен быть внутри рабочей папки." };
  }

  return { ok: true, relativePath: rel };
}

export function isInsideWorkspace(workspacePath: string, absolutePath: string): boolean {
  const root = resolve(workspacePath.trim());
  const full = resolve(absolutePath);
  return full === root || full.startsWith(root + sep);
}
