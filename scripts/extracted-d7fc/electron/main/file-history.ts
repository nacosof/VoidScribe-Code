import { createHash } from "crypto";
import { app } from "electron";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "fs/promises";
import { join, resolve } from "path";

const MAX_VERSIONS_PER_FILE = 40;
const MAX_BLOB_BYTES = 512 * 1024;

type HistorySource = "agent" | "user";

type HistoryEntryMeta = {
  id: string;
  savedAt: number;
  source: HistorySource;
  size: number;
  /** Файла не было — снимок «до создания». */
  missing: boolean;
};

type FileHistoryIndex = {
  files: Record<string, { entries: HistoryEntryMeta[] }>;
};

function workspaceHistoryDir(workspaceRoot: string): string {
  const hash = createHash("sha256")
    .update(resolve(workspaceRoot))
    .digest("hex")
    .slice(0, 16);
  return join(app.getPath("userData"), "file-history", hash);
}

function indexPath(workspaceRoot: string): string {
  return join(workspaceHistoryDir(workspaceRoot), "index.json");
}

function blobPath(workspaceRoot: string, entryId: string): string {
  return join(workspaceHistoryDir(workspaceRoot), "blobs", `${entryId}.txt`);
}

function normalizeRelativePath(targetPath: string): string {
  return targetPath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function createEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readIndex(workspaceRoot: string): Promise<FileHistoryIndex> {
  try {
    const raw = await readFile(indexPath(workspaceRoot), "utf8");
    const parsed = JSON.parse(raw) as FileHistoryIndex;
    if (!parsed || typeof parsed !== "object" || !parsed.files) {
      return { files: {} };
    }
    return parsed;
  } catch {
    return { files: {} };
  }
}

async function writeIndex(
  workspaceRoot: string,
  index: FileHistoryIndex
): Promise<void> {
  const dir = workspaceHistoryDir(workspaceRoot);
  await mkdir(join(dir, "blobs"), { recursive: true });
  await writeFile(indexPath(workspaceRoot), JSON.stringify(index), "utf8");
}

async function deleteBlob(workspaceRoot: string, entryId: string): Promise<void> {
  try {
    await unlink(blobPath(workspaceRoot, entryId));
  } catch {
    /* ignore */
  }
}

export type FileHistoryListItem = {
  stepsBack: number;
  savedAt: number;
  source: HistorySource;
  size: number;
  missing: boolean;
  preview: string;
};

export async function recordFileSnapshot(
  workspaceRoot: string,
  targetPath: string,
  previousContent: string | null,
  source: HistorySource
): Promise<void> {
  const path = normalizeRelativePath(targetPath);
  if (!path) return;

  const missing = previousContent === null;
  const size = missing ? 0 : Buffer.byteLength(previousContent, "utf8");
  if (!missing && size > MAX_BLOB_BYTES) return;

  const index = await readIndex(workspaceRoot);
  const fileRecord = index.files[path] ?? { entries: [] };
  const latest = fileRecord.entries[0];

  if (
    latest &&
    latest.missing === missing &&
    !missing &&
    latest.size === size
  ) {
    try {
      const existing = await readFile(blobPath(workspaceRoot, latest.id), "utf8");
      if (existing === previousContent) return;
    } catch {
      /* new snapshot needed */
    }
  }

  const entry: HistoryEntryMeta = {
    id: createEntryId(),
    savedAt: Date.now(),
    source,
    size,
    missing,
  };

  if (!missing) {
    await mkdir(join(workspaceHistoryDir(workspaceRoot), "blobs"), {
      recursive: true,
    });
    await writeFile(blobPath(workspaceRoot, entry.id), previousContent!, "utf8");
  }

  const nextEntries = [entry, ...fileRecord.entries].slice(0, MAX_VERSIONS_PER_FILE);
  const dropped = fileRecord.entries.slice(MAX_VERSIONS_PER_FILE - 1);
  for (const old of dropped) {
    await deleteBlob(workspaceRoot, old.id);
  }

  index.files[path] = { entries: nextEntries };
  await writeIndex(workspaceRoot, index);
}

export async function listFileHistory(
  workspaceRoot: string,
  targetPath: string
): Promise<FileHistoryListItem[]> {
  const path = normalizeRelativePath(targetPath);
  const index = await readIndex(workspaceRoot);
  const entries = index.files[path]?.entries ?? [];

  const items: FileHistoryListItem[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    let preview = entry.missing ? "(файла ещё не было)" : "";
    if (!entry.missing) {
      try {
        const content = await readFile(blobPath(workspaceRoot, entry.id), "utf8");
        preview = content.replace(/\s+/g, " ").trim().slice(0, 120);
      } catch {
        preview = "(снимок недоступен)";
      }
    }
    items.push({
      stepsBack: i + 1,
      savedAt: entry.savedAt,
      source: entry.source,
      size: entry.size,
      missing: entry.missing,
      preview,
    });
  }
  return items;
}

export async function readFileHistoryVersion(
  workspaceRoot: string,
  targetPath: string,
  stepsBack: number
): Promise<{ missing: true } | { missing: false; content: string }> {
  const path = normalizeRelativePath(targetPath);
  const index = await readIndex(workspaceRoot);
  const entry = index.files[path]?.entries[stepsBack - 1];
  if (!entry) {
    throw new Error(
      `Нет снимка steps_back=${stepsBack} для «${path}». Вызови list_file_history.`
    );
  }
  if (entry.missing) {
    return { missing: true };
  }
  const content = await readFile(blobPath(workspaceRoot, entry.id), "utf8");
  if (Buffer.byteLength(content, "utf8") > MAX_BLOB_BYTES) {
    throw new Error("Снимок слишком большой для восстановления.");
  }
  return { missing: false, content };
}
