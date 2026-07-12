import { readdir, stat } from "fs/promises";
import { join } from "path";
import { resolveWorkspacePath } from "./workspace";
export type ProjectEntryLayout = {
    nextJsAppDir: "src/app" | "app" | "pages" | null;
    hasDuplicateRootApp: boolean;
};
export type ScaffoldHint = {
    stack: string;
    command: string;
};
const PROJECT_MANIFEST_NAMES = new Set(["package.json", "vite.config.ts", "vite.config.js", "next.config.js", "next.config.mjs", "cargo.toml", "go.mod", "pyproject.toml", "composer.json"]);
const BOOTSTRAP_FILE_RE = /^(package\.json|vite\.config\.[cm]?[jt]s|tsconfig\.json|index\.html)$/i;
async function workspaceDirExists(root: string, rel: string): Promise<boolean> { try {
    return (await stat(resolveWorkspacePath(root, rel))).isDirectory();
}
catch {
    return false;
} }
export async function detectProjectEntryLayout(workspaceRoot: string): Promise<ProjectEntryLayout> { const hasSrcApp = await workspaceDirExists(workspaceRoot, "src/app"); const hasRootApp = await workspaceDirExists(workspaceRoot, "app"); const hasPages = await workspaceDirExists(workspaceRoot, "pages"); return { nextJsAppDir: hasSrcApp ? "src/app" : hasRootApp ? "app" : hasPages ? "pages" : null, hasDuplicateRootApp: hasSrcApp && hasRootApp }; }
export function projectEntryLayoutHints(layout: ProjectEntryLayout): string[] { if (layout.nextJsAppDir === "src/app")
    return ["Next.js (--src-dir): pages and layout live in src/app; do not create root app/."]; if (layout.nextJsAppDir === "app")
    return ["Next.js App Router: edit app/ at project root."]; if (layout.nextJsAppDir === "pages")
    return ["Next.js Pages Router: edit pages/."]; return []; }
export const SCAFFOLD_NUDGE_NEUTRAL = "Продолжай задачу инструментами. Scaffold — только если пользователь явно просил создать проект.";
export const SCAFFOLD_PRIORITY_HINT = "Scaffold only when the user explicitly asked to create a project/site/landing.";
function userWantsJavaScriptNotTypeScript(text: string): boolean { return /javascript| js\b|на js|без typescript|без ts/i.test(text) && !/typescript|\bts\b/i.test(text); }
function userExplicitlyWantsNext(text: string): boolean { return /next\.js|nextjs|next app/i.test(text); }
function inferScaffoldHints(text: string): ScaffoldHint[] { const msg = text.toLowerCase(); const out: ScaffoldHint[] = []; if (/next/.test(msg))
    out.push({ stack: "Next.js", command: "npx create-next-app@latest . --js" });
else if (/react|vite|лендинг|landing|site|сайт/.test(msg))
    out.push({ stack: "Vite React", command: "npm create vite@latest . -- --template react" }); if (/vue/.test(msg))
    out.push({ stack: "Vue", command: "npm create vite@latest . -- --template vue" }); return out; }
export function buildScaffoldNudge(userIntent: string): string { const hints = inferScaffoldHints(userIntent); if (!hints.length)
    return SCAFFOLD_NUDGE_NEUTRAL; const h = hints[0]!; return `Проект не развёрнут. Стек из запроса: ${h.stack}. run_command: ${h.command}.`; }
export function scaffoldStackMismatchMessage(command: string, userIntent: string): string | null { if (!userWantsJavaScriptNotTypeScript(userIntent))
    return null; if (userExplicitlyWantsNext(userIntent) && /--js\b/i.test(command))
    return null; if (/typescript|react-ts|--ts\b/i.test(command))
    return "Пользователь просил JavaScript. Используй JS-шаблон, например npm create vite@latest . -- --template react"; return null; }
export function bootstrapWithoutUserRequestMessage(): string { return "Пользователь не просил создавать проект. Не запускай scaffold/init команды."; }
export function wrongNextJsWritePath(layout: ProjectEntryLayout, relativePath: string): string | null { const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, ""); return layout.nextJsAppDir === "src/app" && (normalized === "app" || normalized.startsWith("app/")) ? "Проект использует src/app/, а не root app/." : null; }
export function isBootstrapArtifactPath(relativePath: string): boolean { const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, ""); const base = normalized.split("/").pop() ?? normalized; return BOOTSTRAP_FILE_RE.test(base) || BOOTSTRAP_FILE_RE.test(normalized); }
export function manualBootstrapWriteBlockedMessage(hints: ScaffoldHint[] = []): string { return `Каркас проекта создавай через official CLI/run_command, не write_file.${hints.length ? ` ${hints.map((h) => `${h.stack}: ${h.command}`).join(" | ")}` : ""}`; }
export async function hasMatureProjectAt(workspaceRoot: string, relativeCwd = "."): Promise<boolean> { try {
    const dir = resolveWorkspacePath(workspaceRoot, relativeCwd);
    const entries = await readdir(dir, { withFileTypes: true });
    const names = entries.map((e) => e.name.toLowerCase());
    if (names.some((name) => PROJECT_MANIFEST_NAMES.has(name)))
        return true;
    for (const sub of ["src", "app", "pages", "lib"]) {
        if (!names.includes(sub))
            continue;
        const subEntries = await readdir(join(dir, sub), { withFileTypes: true }).catch(() => []);
        if (subEntries.some((e) => e.isFile() && /\.(tsx?|jsx?|vue|css)$/i.test(e.name)))
            return true;
    }
    return false;
}
catch {
    return false;
} }
