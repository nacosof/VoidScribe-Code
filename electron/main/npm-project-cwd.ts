import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { normalizeAgentRelativePath, resolveWorkspacePath } from "./workspace";

const DEV_SERVER_COMMAND_RE = /^(npm run (dev|start)|npm start|next dev|npx next dev|yarn dev|pnpm (run )?dev|pnpm start|vite(\s|$)|npx vite|flutter run|cargo run|go run\b)/i;

export function isDevServerCommand(command: string): boolean {
    const trimmed = command.trim();
    if (!trimmed || /\b(--help|-h)\b/.test(trimmed))
        return false;
    return DEV_SERVER_COMMAND_RE.test(trimmed);
}

export type NpmCwdResolution = {
    cwd: string;
    adjusted: boolean;
    note: string;
};

const SKIP_DIR_NAMES = new Set(["node_modules", ".git", ".voidscribe", "dist", "build", ".next"]);

export function isNpmProjectLocalCommand(command: string): boolean {
    const trimmed = command.trim();
    if (!trimmed)
        return false;
    if (/\b(npm create|npx create|pnpm create|yarn create|npm init)\b/i.test(trimmed))
        return false;
    if (isDevServerCommand(trimmed))
        return true;
    return /\b(npm (install|ci|run|start|test)|pnpm (install|run|start)|yarn (install|run|start)|npx (vite|next))\b/i.test(trimmed);
}

export async function hasPackageJson(workspaceRoot: string, relativeCwd: string): Promise<boolean> {
    try {
        const target = resolveWorkspacePath(workspaceRoot, join(relativeCwd, "package.json"));
        return (await stat(target)).isFile();
    }
    catch {
        return false;
    }
}

export async function hasNodeModules(workspaceRoot: string, relativeCwd: string): Promise<boolean> {
    try {
        const target = resolveWorkspacePath(workspaceRoot, join(relativeCwd, "node_modules"));
        return (await stat(target)).isDirectory();
    }
    catch {
        return false;
    }
}

export function inferProjectDirFromAgentPaths(paths: string[]): string | null {
    const counts = new Map<string, number>();
    for (const raw of paths) {
        const normalized = raw.replace(/\\/g, "/").replace(/^\.\//, "");
        const parts = normalized.split("/").filter(Boolean);
        if (parts.length < 2)
            continue;
        const top = parts[0]!;
        counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [dir, count] of counts) {
        if (count > bestCount) {
            best = dir;
            bestCount = count;
        }
    }
    return best;
}

export async function findPackageJsonSubdirs(workspaceRoot: string, relativeDir = ".", depth = 0, maxDepth = 2): Promise<string[]> {
    if (depth > maxDepth)
        return [];
    const results: string[] = [];
    let entries;
    try {
        entries = await readdir(resolveWorkspacePath(workspaceRoot, relativeDir), { withFileTypes: true });
    }
    catch {
        return [];
    }
    for (const entry of entries) {
        if (!entry.isDirectory() || SKIP_DIR_NAMES.has(entry.name) || entry.name.startsWith("."))
            continue;
        const rel = relativeDir === "." ? entry.name : `${relativeDir}/${entry.name}`.replace(/\\/g, "/");
        if (await hasPackageJson(workspaceRoot, rel)) {
            results.push(rel);
            continue;
        }
        if (depth < maxDepth) {
            results.push(...await findPackageJsonSubdirs(workspaceRoot, rel, depth + 1, maxDepth));
        }
    }
    return results;
}

export async function resolveNpmProjectCwd(workspaceRoot: string, command: string, requestedCwd: string, agentFilePaths: string[]): Promise<NpmCwdResolution> {
    const cwd = normalizeAgentRelativePath(requestedCwd || ".");
    if (!isNpmProjectLocalCommand(command)) {
        return { cwd, adjusted: false, note: "" };
    }
    if (await hasPackageJson(workspaceRoot, cwd)) {
        return { cwd, adjusted: false, note: "" };
    }
    const fromPaths = inferProjectDirFromAgentPaths(agentFilePaths);
    if (fromPaths && await hasPackageJson(workspaceRoot, fromPaths)) {
        return {
            cwd: fromPaths,
            adjusted: true,
            note: `[VoidScribe] cwd: «${cwd}» → «${fromPaths}» (package.json в подпапке, куда агент писал файлы).`,
        };
    }
    const candidates = await findPackageJsonSubdirs(workspaceRoot);
    if (candidates.length === 1) {
        return {
            cwd: candidates[0]!,
            adjusted: true,
            note: `[VoidScribe] cwd: «${cwd}» → «${candidates[0]}» (единственный package.json в workspace).`,
        };
    }
    if (fromPaths && candidates.includes(fromPaths)) {
        return {
            cwd: fromPaths,
            adjusted: true,
            note: `[VoidScribe] cwd: «${cwd}» → «${fromPaths}» (package.json в подпапке проекта).`,
        };
    }
    if (candidates.length > 1) {
        return {
            cwd,
            adjusted: false,
            note: `[VoidScribe] В «${cwd}» нет package.json. Подпапки с package.json: ${candidates.join(", ")}. ` +
                `Укажи cwd в run_command (например cwd: «${candidates[0]}»).`,
        };
    }
    return {
        cwd,
        adjusted: false,
        note: "",
    };
}

const DEV_URL_PATTERNS = [
    /➜\s+Local:\s+(https?:\/\/[^\s]+)/i,
    /\bLocal:\s+(https?:\/\/[^\s]+)/i,
    /\blocal:\s+(https?:\/\/[^\s]+)/i,
    /started server on\s+(https?:\/\/[^\s,]+)/i,
    /\b(https?:\/\/localhost:\d+)\b/i,
    /\b(https?:\/\/127\.0\.0\.1:\d+)\b/i,
];

/** Ports used by VoidScribe IDE (electron-vite dev). Not the user's project preview. */
export const VOIDSCRIBE_RENDERER_DEV_PORTS = new Set([5173, 14200]);

/** Default port for agent-started user project dev servers. */
export const AGENT_USER_DEV_PORT = 5180;

export function isLikelyIdeDevUrl(url: string): boolean {
    const match = url.match(/:(\d+)(?:\/|$)/);
    if (!match)
        return false;
    return VOIDSCRIBE_RENDERER_DEV_PORTS.has(Number(match[1]));
}

async function readPackageDevScript(workspaceRoot: string, relativeCwd: string): Promise<string | null> {
    try {
        const raw = await readFile(resolveWorkspacePath(workspaceRoot, join(relativeCwd, "package.json")), "utf8");
        const pkg = JSON.parse(raw) as { scripts?: { dev?: string; start?: string } };
        return pkg.scripts?.dev ?? pkg.scripts?.start ?? null;
    }
    catch {
        return null;
    }
}

function devServerPortNote(port: number): string {
    return `[VoidScribe] Запуск dev-сервера проекта на порту ${port} (VoidScribe IDE — :14200). URL появится в выводе после «Local:».`;
}

export async function withAgentDevServerPort(workspaceRoot: string, relativeCwd: string, command: string): Promise<{
    command: string;
    note: string;
}> {
    const trimmed = command.trim();
    if (!isDevServerCommand(trimmed))
        return { command: trimmed, note: "" };
    if (/\B--port(?:=|\s+)\d+/i.test(trimmed) || /\B-p(?:=|\s+)\d+/i.test(trimmed))
        return { command: trimmed, note: "" };
    const port = AGENT_USER_DEV_PORT;
    const devScript = await readPackageDevScript(workspaceRoot, relativeCwd);
    const note = devServerPortNote(port);
    if (/^npm run dev\b/i.test(trimmed) || /^pnpm run dev\b/i.test(trimmed) || /^yarn dev\b/i.test(trimmed)) {
        if (devScript && /next\s+dev/i.test(devScript)) {
            return { command: `npx next dev -p ${port}`, note };
        }
        if (!devScript || /vite/i.test(devScript)) {
            return { command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`, note };
        }
        return { command: trimmed, note: "" };
    }
    if (/^npm start\b/i.test(trimmed)) {
        if (devScript && /next\s+start/i.test(devScript)) {
            return { command: trimmed, note: "" };
        }
        if (!devScript || /vite/i.test(devScript)) {
            return { command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`, note };
        }
    }
    let next = trimmed;
    if (/^(?:npx\s+)?vite\b/i.test(trimmed)) {
        next = `${trimmed} --host 127.0.0.1 --port ${port} --strictPort`;
    }
    else if (/^(?:npx\s+)?next dev\b/i.test(trimmed)) {
        next = `${trimmed} -p ${port}`;
    }
    if (next === trimmed)
        return { command: trimmed, note: "" };
    return { command: next, note };
}

export function extractDevServerUrl(output: string, options?: { excludeIdePorts?: boolean }): string | null {
    const excludeIde = options?.excludeIdePorts ?? true;
    for (const pattern of DEV_URL_PATTERNS) {
        const match = output.match(pattern);
        const url = match?.[1]?.replace(/[\x1b\[\]0-9;]*m/g, "").trim();
        if (!url)
            continue;
        if (excludeIde && isLikelyIdeDevUrl(url))
            continue;
        return url;
    }
    return null;
}

export function formatDevServerPreviewNote(output: string, relativeCwd: string): string {
    const url = extractDevServerUrl(output, { excludeIdePorts: true });
    if (!url) {
        const ideUrl = extractDevServerUrl(output, { excludeIdePorts: false });
        if (ideUrl && isLikelyIdeDevUrl(ideUrl)) {
            return `\n[VoidScribe] В выводе только порт VoidScribe IDE (${ideUrl}) — это НЕ сайт пользователя. ` +
                `Запусти dev с cwd «${relativeCwd}» и портом ${AGENT_USER_DEV_PORT} (npx vite --port ${AGENT_USER_DEV_PORT}).`;
        }
        return "";
    }
    const folderHint = relativeCwd !== "." ? ` (папка ${relativeCwd})` : "";
    return `\n[VoidScribe] Dev-сервер поднялся${folderHint}. Открой в браузере: ${url}\n` +
        `Сообщи пользователю ссылку и что сайт готов. Для повторного просмотра: npm run dev с cwd «${relativeCwd}».`;
}
