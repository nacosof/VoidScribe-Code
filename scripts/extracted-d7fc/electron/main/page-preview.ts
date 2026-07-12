import { BrowserWindow, nativeImage } from "electron";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { pathToFileURL } from "url";
import { assertWorkspaceRoot, resolveWorkspacePath } from "./workspace";

const PREVIEW_SUBDIR = join(".voidscribe", "previews");
const MAX_CAPTURE_WIDTH = 1280;
const DEFAULT_VIEWPORT = { width: 1280, height: 900 };

export class PagePreviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PagePreviewError";
  }
}

function normalizePreviewUrl(
  rawUrl: string,
  workspaceRoot: string
): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "http://localhost:3000/";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1") {
      throw new PagePreviewError(
        "Разрешены только http://localhost и http://127.0.0.1 (dev-сервер)."
      );
    }
    return parsed.toString();
  }

  const root = assertWorkspaceRoot(workspaceRoot);
  const relative = trimmed.replace(/^\.[\\/]/, "");
  const absolute = resolveWorkspacePath(root, relative);
  if (!absolute.toLowerCase().endsWith(".html")) {
    throw new PagePreviewError(
      "Локальный путь должен указывать на .html файл в проекте."
    );
  }
  return pathToFileURL(absolute).href;
}

function resizeForModel(image: Electron.NativeImage): Electron.NativeImage {
  const { width } = image.getSize();
  if (width <= MAX_CAPTURE_WIDTH) return image;
  return image.resize({ width: MAX_CAPTURE_WIDTH });
}

export async function capturePagePreview(input: {
  workspaceRoot: string;
  url?: string;
  waitMs?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}): Promise<{
  base64: string;
  savedRelativePath: string;
  url: string;
  width: number;
  height: number;
}> {
  const workspaceRoot = assertWorkspaceRoot(input.workspaceRoot);
  const url = normalizePreviewUrl(input.url ?? "http://localhost:3000/", workspaceRoot);
  const waitMs =
    typeof input.waitMs === "number" && input.waitMs >= 0
      ? Math.min(Math.floor(input.waitMs), 15_000)
      : 1500;
  const viewportWidth =
    typeof input.viewportWidth === "number" && input.viewportWidth > 0
      ? Math.min(Math.floor(input.viewportWidth), 1920)
      : DEFAULT_VIEWPORT.width;
  const viewportHeight =
    typeof input.viewportHeight === "number" && input.viewportHeight > 0
      ? Math.min(Math.floor(input.viewportHeight), 1200)
      : DEFAULT_VIEWPORT.height;

  const win = new BrowserWindow({
    show: false,
    width: viewportWidth,
    height: viewportHeight,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  try {
    await win.loadURL(url, { timeout: 45_000 });
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const captured = await win.webContents.capturePage();
    const resized = resizeForModel(captured);
    const png = resized.toPNG();
    const base64 = png.toString("base64");
    const { width, height } = resized.getSize();

    const previewDir = join(workspaceRoot, PREVIEW_SUBDIR);
    await mkdir(previewDir, { recursive: true });
    const savedRelativePath = join(PREVIEW_SUBDIR, "last.png").replace(/\\/g, "/");
    await writeFile(join(workspaceRoot, savedRelativePath), png);

    return { base64, savedRelativePath, url, width, height };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Не удалось сделать скриншот.";
    if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(message)) {
      throw new PagePreviewError(
        `Страница недоступна (${url}). Запусти dev-сервер: npm run dev, затем повтори capture_page_preview.`
      );
    }
    throw new PagePreviewError(message);
  } finally {
    win.destroy();
  }
}
