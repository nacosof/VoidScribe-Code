import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "os";
import { join, dirname, basename } from "path";
import { promisify } from "util";
import { app } from "electron";
import { getLintStrategy, type LintStrategy } from "../../src/lib/language-registry";
import { lintNonAsciiIdentifiers } from "../../src/lib/non-ascii-lint";
import { lintTypeScriptSemantics } from "./typescript-lint";
import { lintWithRuff } from "./ruff-lint";
import { resolvePythonCommands } from "./python-env";
import { resolveWorkspacePath } from "./workspace";
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
export type LintSeverity = "error" | "warning" | "info" | "hint";
export type LintDiagnostic = {
    line: number;
    column: number;
    endColumn: number;
    severity: LintSeverity;
    message: string;
};
function getPythonLintScriptPath(): string {
    if (app.isPackaged) {
        return join(process.resourcesPath, "python-lint.py");
    }
    return join(process.cwd(), "electron/main/python-lint.py");
}
function normalizeSeverity(value: string): LintSeverity {
    if (value === "warning" || value === "info" || value === "hint") {
        return value;
    }
    return "error";
}
function dedupeDiagnostics(items: LintDiagnostic[]): LintDiagnostic[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = `${item.line}:${item.column}:${item.endColumn}:${item.message}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function normalizeDiagnostic(raw: LintDiagnostic): LintDiagnostic {
    return {
        line: Math.max(1, raw.line || 1),
        column: Math.max(0, raw.column || 0),
        endColumn: Math.max(raw.column || 0, raw.endColumn || (raw.column || 0) + 1),
        severity: normalizeSeverity(raw.severity),
        message: raw.message || "Ошибка",
    };
}
function offsetToLineCol(content: string, offset: number): {
    line: number;
    column: number;
} {
    const safe = Math.max(0, Math.min(offset, content.length));
    const before = content.slice(0, safe);
    return {
        line: before.split("\n").length,
        column: (before.split("\n").pop() ?? "").length,
    };
}
function pushDiagnostic(list: LintDiagnostic[], line: number, column: number, endColumn: number, message: string, severity: LintSeverity = "error") {
    list.push({ line, column, endColumn, severity, message });
}
function lintJson(content: string): LintDiagnostic[] {
    try {
        JSON.parse(content);
        return [];
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Некорректный JSON";
        const positionMatch = /position (\d+)/i.exec(message);
        if (positionMatch) {
            const pos = offsetToLineCol(content, Number(positionMatch[1]));
            return [{ ...pos, endColumn: pos.column + 1, severity: "error", message }];
        }
        return [{ line: 1, column: 0, endColumn: 1, severity: "error", message }];
    }
}
function esbuildLoader(filePath: string): "js" | "jsx" | "ts" | "tsx" {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".tsx"))
        return "tsx";
    if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts"))
        return "ts";
    if (lower.endsWith(".jsx"))
        return "jsx";
    return "js";
}
function lintJavaScriptSyntax(relativePath: string, content: string): LintDiagnostic[] {
    try {
        const esbuild = require("esbuild") as typeof import("esbuild");
        esbuild.transformSync(content, {
            loader: esbuildLoader(relativePath),
            sourcefile: relativePath,
            target: "es2022",
            jsx: /jsx|tsx$/i.test(relativePath) ? "automatic" : undefined,
            tsconfigRaw: { compilerOptions: { jsx: "react-jsx", target: "ES2022" } },
        });
        return [];
    }
    catch (err) {
        const failure = err as {
            errors?: Array<{
                location?: {
                    line: number;
                    column: number;
                    lineText?: string;
                };
                text: string;
            }>;
        };
        if (!failure.errors?.length) {
            const message = err instanceof Error ? err.message : "Синтаксическая ошибка";
            return [{ line: 1, column: 0, endColumn: 1, severity: "error", message }];
        }
        return failure.errors.map((item) => {
            const line = item.location?.line ?? 1;
            const column = Math.max(0, (item.location?.column ?? 1) - 1);
            const lineText = item.location?.lineText ?? "";
            return {
                line,
                column,
                endColumn: Math.max(column + 1, Math.min(lineText.length, column + 4)),
                severity: "error" as const,
                message: item.text.trim(),
            };
        });
    }
}
function lintJavaScript(relativePath: string, content: string, workspaceRoot: string, semantic = false): LintDiagnostic[] {
    const syntax = lintJavaScriptSyntax(relativePath, content);
    if (!semantic || syntax.some((item) => item.severity === "error")) {
        return syntax;
    }
    try {
        const typeDiagnostics = lintTypeScriptSemantics(workspaceRoot, relativePath, content);
        return dedupeDiagnostics([...syntax, ...typeDiagnostics]);
    }
    catch {
        return syntax;
    }
}
function lintVue(content: string, workspaceRoot: string, semantic = false): LintDiagnostic[] {
    const scriptMatch = /<script\b[^>]*>([\s\S]*?)<\/script>/i.exec(content);
    if (!scriptMatch?.[1]?.trim())
        return lintHtml(content);
    return lintJavaScript("component.vue", scriptMatch[1], workspaceRoot, semantic);
}
function lintCss(relativePath: string, content: string): LintDiagnostic[] {
    try {
        const postcss = require("postcss") as typeof import("postcss");
        postcss.parse(content, { from: relativePath });
        return [];
    }
    catch (err) {
        const input = err as {
            name?: string;
            reason?: string;
            line?: number;
            column?: number;
            endColumn?: number;
        };
        if (input.name === "CssSyntaxError") {
            const line = input.line ?? 1;
            const column = Math.max(0, (input.column ?? 1) - 1);
            return [
                {
                    line,
                    column,
                    endColumn: input.endColumn ? Math.max(column + 1, input.endColumn - 1) : column + 1,
                    severity: "error",
                    message: input.reason || "Синтаксическая ошибка CSS",
                },
            ];
        }
        return [
            {
                line: 1,
                column: 0,
                endColumn: 1,
                severity: "error",
                message: err instanceof Error ? err.message : "Синтаксическая ошибка CSS",
            },
        ];
    }
}
function lintHtml(content: string): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const stack: string[] = [];
    const voidTags = new Set([
        "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
    ]);
    const tagRe = /<\/?([a-zA-Z][\w:-]*)\b[^>]*\/?>/g;
    for (const match of content.matchAll(tagRe)) {
        const raw = match[0];
        const name = match[1]?.toLowerCase() ?? "";
        const lineStart = content.lastIndexOf("\n", match.index ?? 0) + 1;
        const line = content.slice(0, match.index ?? 0).split("\n").length;
        const column = (match.index ?? 0) - lineStart;
        if (raw.startsWith("</")) {
            const open = stack.pop();
            if (!open || open !== name) {
                pushDiagnostic(diagnostics, line, Math.max(0, column), Math.max(0, column) + name.length + 3, open ? `Ожидался </${open}>, найден </${name}>` : `Лишний закрывающий тег </${name}>`);
            }
            continue;
        }
        if (raw.endsWith("/>") || voidTags.has(name))
            continue;
        stack.push(name);
    }
    for (const open of stack) {
        pushDiagnostic(diagnostics, content.split("\n").length, 0, 1, `Незакрытый тег <${open}>`);
    }
    return diagnostics;
}
function lintYaml(content: string): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    content.split("\n").forEach((line, index) => {
        if (!line.trim() || line.trim().startsWith("#"))
            return;
        const tab = line.indexOf("\t");
        if (tab >= 0) {
            pushDiagnostic(diagnostics, index + 1, tab, tab + 1, "YAML: используйте пробелы вместо табов");
        }
    });
    return diagnostics;
}
function lintToml(content: string): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    content.split("\n").forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            return;
        if (/^\[[^\]]+$/.test(trimmed)) {
            pushDiagnostic(diagnostics, index + 1, line.indexOf("["), line.length, "Незакрытая секция TOML");
        }
    });
    return diagnostics;
}
function lintSql(content: string): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    let quote: "'" | '"' | null = null;
    for (let i = 0; i < content.length; i += 1) {
        const ch = content[i]!;
        if (quote) {
            if (ch === quote)
                quote = null;
            continue;
        }
        if (ch === "'" || ch === '"')
            quote = ch;
    }
    if (quote) {
        const pos = offsetToLineCol(content, content.length);
        pushDiagnostic(diagnostics, pos.line, pos.column, pos.column + 1, "Незакрытая строка в SQL");
    }
    return diagnostics;
}
function lintDockerfile(content: string): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const lines = content.split("\n");
    let hasInstruction = false;
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            return;
        hasInstruction = true;
        if (!/^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\b/i.test(trimmed)) {
            pushDiagnostic(diagnostics, index + 1, 0, Math.min(8, trimmed.length), "Неизвестная инструкция Dockerfile");
        }
    });
    if (!hasInstruction && content.trim()) {
        pushDiagnostic(diagnostics, 1, 0, 1, "Dockerfile пустой или без инструкций");
    }
    return diagnostics;
}
function lintGraphql(content: string): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    let braces = 0;
    for (let i = 0; i < content.length; i += 1) {
        const ch = content[i]!;
        if (ch === "{")
            braces += 1;
        if (ch === "}")
            braces -= 1;
        if (braces < 0) {
            const pos = offsetToLineCol(content, i);
            pushDiagnostic(diagnostics, pos.line, pos.column, pos.column + 1, "Лишняя закрывающая скобка");
            braces = 0;
        }
    }
    if (braces > 0) {
        pushDiagnostic(diagnostics, content.split("\n").length, 0, 1, "Незакрытая фигурная скобка");
    }
    return diagnostics;
}
function parseCompilerDiagnostics(stderr: string): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const rustRe = /^(?:error|warning)(?:\[[^\]]+\])?:[^\n]*\n\s*-->\s*[^:]+:(\d+):(\d+)/gm;
    for (const match of stderr.matchAll(rustRe)) {
        const messageLine = stderr.slice(0, match.index).split("\n").pop()?.trim() ?? "Ошибка компиляции";
        pushDiagnostic(diagnostics, Number(match[1]), Math.max(0, Number(match[2]) - 1), Math.max(0, Number(match[2])), messageLine.replace(/^(?:error|warning)(?:\[[^\]]+\])?:\s*/, ""), messageLine.startsWith("warning") ? "warning" : "error");
    }
    if (diagnostics.length)
        return diagnostics;
    const clangRe = /[^:]+:(\d+):(\d+):\s*(error|warning):\s*(.+)/g;
    for (const match of stderr.matchAll(clangRe)) {
        pushDiagnostic(diagnostics, Number(match[1]), Math.max(0, Number(match[2]) - 1), Math.max(0, Number(match[2])), match[4]?.trim() || "Ошибка компиляции", match[3] === "warning" ? "warning" : "error");
    }
    if (diagnostics.length)
        return diagnostics;
    const gofmtRe = /:(\d+):(\d+):\s*(.+)/g;
    for (const match of stderr.matchAll(gofmtRe)) {
        pushDiagnostic(diagnostics, Number(match[1]), Math.max(0, Number(match[2]) - 1), Math.max(0, Number(match[2])), match[3]?.trim() || "Ошибка Go");
    }
    if (diagnostics.length)
        return diagnostics;
    const phpRe = /(?:Parse error|Fatal error|syntax error)[^:]*:\s*(.+?)\s+in\s+.+\s+on\s+line\s+(\d+)/gi;
    for (const match of stderr.matchAll(phpRe)) {
        pushDiagnostic(diagnostics, Number(match[2]), 0, 1, match[1]?.trim() || "Ошибка PHP");
    }
    if (diagnostics.length)
        return diagnostics;
    const rubyRe = /:(\d+):\s*(?:syntax error|.*SyntaxError).*?:\s*(.+)$/gm;
    for (const match of stderr.matchAll(rubyRe)) {
        pushDiagnostic(diagnostics, Number(match[1]), 0, 1, match[2]?.trim() || "Ошибка Ruby");
    }
    if (diagnostics.length)
        return diagnostics;
    const genericRe = /line\s+(\d+)(?:[,:]\s*column\s+(\d+))?[^\n]*:?\s*(.+)/gi;
    for (const match of stderr.matchAll(genericRe)) {
        pushDiagnostic(diagnostics, Number(match[1]), match[2] ? Math.max(0, Number(match[2]) - 1) : 0, match[2] ? Math.max(0, Number(match[2])) : 1, match[3]?.trim() || "Ошибка");
    }
    const firstLine = stderr.split("\n").find((line) => line.trim());
    if (!diagnostics.length && firstLine) {
        pushDiagnostic(diagnostics, 1, 0, 1, firstLine.trim());
    }
    return diagnostics;
}
async function runCompilerLint(content: string, extension: string, candidates: [
    string,
    string[]
][]): Promise<LintDiagnostic[]> {
    const tempPath = join(tmpdir(), `voidscribe-lint-${randomBytes(8).toString("hex")}.${extension}`);
    await writeFile(tempPath, content, "utf8");
    try {
        for (const [command, args] of candidates) {
            try {
                await execFileAsync(command, [...args, tempPath], {
                    timeout: 25000,
                    maxBuffer: 4 * 1024 * 1024,
                    windowsHide: true,
                });
                return [];
            }
            catch (err) {
                const execErr = err as {
                    stderr?: string;
                    stdout?: string;
                    message?: string;
                };
                const combined = `${execErr.stderr ?? ""}\n${execErr.stdout ?? ""}\n${execErr.message ?? ""}`.trim();
                if (!combined || /ENOENT/i.test(combined))
                    continue;
                const parsed = parseCompilerDiagnostics(combined);
                if (parsed.length)
                    return parsed;
            }
        }
        return [];
    }
    finally {
        await unlink(tempPath).catch(() => undefined);
    }
}
async function lintDart(content: string): Promise<LintDiagnostic[]> {
    const tempPath = join(tmpdir(), `voidscribe-lint-${randomBytes(8).toString("hex")}.dart`);
    await writeFile(tempPath, content, "utf8");
    try {
        const { stdout, stderr } = await execFileAsync("dart", ["analyze", "--format", "json", tempPath], { timeout: 25000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
        const payload = JSON.parse(stdout || stderr || "{}") as {
            diagnostics?: Array<{
                severity?: string;
                message?: string;
                location?: {
                    startLine?: number;
                    startColumn?: number;
                    endColumn?: number;
                };
            }>;
        };
        return (payload.diagnostics ?? []).map((item) => ({
            line: item.location?.startLine ?? 1,
            column: Math.max(0, (item.location?.startColumn ?? 1) - 1),
            endColumn: Math.max(1, item.location?.endColumn ?? 2),
            severity: item.severity === "WARNING" ? "warning" : "error",
            message: item.message || "Ошибка Dart",
        }));
    }
    catch (err) {
        const execErr = err as {
            stdout?: string;
            stderr?: string;
        };
        try {
            const payload = JSON.parse(execErr.stdout || execErr.stderr || "{}") as {
                diagnostics?: Array<{
                    severity?: string;
                    message?: string;
                    location?: {
                        startLine?: number;
                        startColumn?: number;
                        endColumn?: number;
                    };
                }>;
            };
            if (payload.diagnostics?.length) {
                return payload.diagnostics.map((item) => ({
                    line: item.location?.startLine ?? 1,
                    column: Math.max(0, (item.location?.startColumn ?? 1) - 1),
                    endColumn: Math.max(1, item.location?.endColumn ?? 2),
                    severity: item.severity === "WARNING" ? "warning" : "error",
                    message: item.message || "Ошибка Dart",
                }));
            }
        }
        catch {
        }
        return parseCompilerDiagnostics(`${execErr.stderr ?? ""}\n${execErr.stdout ?? ""}`);
    }
    finally {
        await unlink(tempPath).catch(() => undefined);
    }
}
function isMissingImportDiagnostic(item: LintDiagnostic): boolean {
    return /Не удалось найти модуль|Could not find module|No module named/i.test(item.message);
}

function missingModuleName(message: string): string | null {
    const match = /[«"]([^»"]+)[»"]/.exec(message)
        ?? /No module named ['"]([^'"]+)['"]/i.exec(message);
    return match?.[1]?.trim() || null;
}

async function canAnyPythonImport(
    commands: ReturnType<typeof resolvePythonCommands>,
    moduleName: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
): Promise<boolean> {
    const code = "import sys\ntry:\n __import__(sys.argv[1])\nexcept Exception:\n raise SystemExit(1)";
    if (commands.length === 0)
        return false;
    return await new Promise<boolean>((resolve) => {
        let remaining = commands.length;
        let done = false;
        for (const { command, prefix } of commands) {
            void execFileAsync(command, [...prefix, "-c", code, moduleName], {
                env,
                timeout: 8000,
                maxBuffer: 256 * 1024,
                cwd,
                windowsHide: true,
            }).then(() => {
                if (!done) {
                    done = true;
                    resolve(true);
                }
            }).catch(() => {
                remaining -= 1;
                if (!done && remaining === 0)
                    resolve(false);
            });
        }
    });
}

async function runPythonLint(content: string, absolutePath: string, workspaceRoot: string): Promise<LintDiagnostic[]> {
    const tempPath = join(tmpdir(), `voidscribe-lint-${randomBytes(8).toString("hex")}.py`);
    await writeFile(tempPath, content, "utf8");
    const env = { ...process.env, VOIDSCRIBE_WORKSPACE: workspaceRoot, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };
    const scriptPath = getPythonLintScriptPath();
    const commands = resolvePythonCommands(workspaceRoot);
    const cwd = dirname(absolutePath);
    try {
        let diagnostics: LintDiagnostic[] | null = null;
        for (const { command, prefix } of commands) {
            try {
                const { stdout } = await execFileAsync(command, [...prefix, scriptPath, tempPath], {
                    env,
                    timeout: 15000,
                    maxBuffer: 1024 * 1024,
                    cwd,
                    windowsHide: true,
                });
                diagnostics = (JSON.parse(stdout.trim() || "[]") as LintDiagnostic[]).map(normalizeDiagnostic);
                break;
            }
            catch {
            }
        }
        if (!diagnostics)
            return [];
        const importAvailability = new Map<string, Promise<boolean>>();
        const resolveImport = (moduleName: string) => {
            let pending = importAvailability.get(moduleName);
            if (!pending) {
                pending = canAnyPythonImport(commands, moduleName, cwd, env);
                importAvailability.set(moduleName, pending);
            }
            return pending;
        };
        const kept: LintDiagnostic[] = [];
        for (const item of diagnostics) {
            if (!isMissingImportDiagnostic(item)) {
                kept.push(item);
                continue;
            }
            const moduleName = missingModuleName(item.message);
            if (!moduleName) {
                kept.push(item);
                continue;
            }
            if (!(await resolveImport(moduleName)))
                kept.push(item);
        }
        return dedupeDiagnostics(kept);
    }
    finally {
        await unlink(tempPath).catch(() => undefined);
    }
}
async function lintR(content: string): Promise<LintDiagnostic[]> {
    const tempPath = join(tmpdir(), `voidscribe-lint-${randomBytes(8).toString("hex")}.r`);
    await writeFile(tempPath, content, "utf8");
    const normalized = tempPath.replace(/\\/g, "/");
    try {
        await execFileAsync("Rscript", ["-e", `parse('${normalized}')`], {
            timeout: 20000,
            maxBuffer: 2 * 1024 * 1024,
            windowsHide: true,
        });
        return [];
    }
    catch (err) {
        const execErr = err as {
            stderr?: string;
            stdout?: string;
        };
        return parseCompilerDiagnostics(`${execErr.stderr ?? ""}\n${execErr.stdout ?? ""}`);
    }
    finally {
        await unlink(tempPath).catch(() => undefined);
    }
}
async function lintPowerShell(content: string): Promise<LintDiagnostic[]> {
    const tempPath = join(tmpdir(), `voidscribe-lint-${randomBytes(8).toString("hex")}.ps1`);
    await writeFile(tempPath, content, "utf8");
    const escaped = tempPath.replace(/'/g, "''");
    const command = `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${escaped}',[ref]$t,[ref]$e);if($e){$e|ForEach-Object{$_.ToString()};exit 1}`;
    try {
        for (const shell of ["pwsh", "powershell"]) {
            try {
                await execFileAsync(shell, ["-NoProfile", "-Command", command], {
                    timeout: 20000,
                    maxBuffer: 2 * 1024 * 1024,
                    windowsHide: true,
                });
                return [];
            }
            catch (err) {
                const execErr = err as {
                    stderr?: string;
                    stdout?: string;
                };
                const parsed = parseCompilerDiagnostics(`${execErr.stderr ?? ""}\n${execErr.stdout ?? ""}`);
                if (parsed.length)
                    return parsed;
            }
        }
        return [];
    }
    finally {
        await unlink(tempPath).catch(() => undefined);
    }
}
async function lintByStrategy(strategy: LintStrategy, relativePath: string, content: string, absolutePath: string, workspaceRoot: string, semantic = false): Promise<LintDiagnostic[]> {
    switch (strategy) {
        case "json":
            return lintJson(content);
        case "javascript":
            return lintJavaScript(relativePath, content, workspaceRoot, semantic);
        case "vue":
            return lintVue(content, workspaceRoot, semantic);
        case "css":
            return lintCss(relativePath, content);
        case "html":
            return lintHtml(content);
        case "yaml":
            return lintYaml(content);
        case "toml":
            return lintToml(content);
        case "sql":
            return lintSql(content);
        case "dockerfile":
            return lintDockerfile(content);
        case "graphql":
            return lintGraphql(content);
        case "python": {
            const basic = await runPythonLint(content, absolutePath, workspaceRoot);
            if (!semantic)
                return basic;
            const ruff = await lintWithRuff(workspaceRoot, relativePath, content);
            return dedupeDiagnostics([...basic, ...ruff]);
        }
        case "rust":
            return runCompilerLint(content, "rs", [["rustc", ["--crate-type", "lib", "--edition", "2021"]]]);
        case "c":
            return runCompilerLint(content, "c", [
                ["clang", ["-fsyntax-only", "-x", "c", "-std=c11"]],
                ["gcc", ["-fsyntax-only", "-x", "c", "-std=c11"]],
            ]);
        case "cpp":
        case "objectivec":
            return runCompilerLint(content, strategy === "objectivec" ? "m" : "cpp", [
                ["clang", ["-fsyntax-only", "-x", strategy === "objectivec" ? "objective-c++" : "c++", "-std=c++17"]],
                ["g++", ["-fsyntax-only", "-x", "c++", "-std=c++17"]],
            ]);
        case "java":
            return runCompilerLint(/^\s*(?:public\s+)?class\s+\w+/m.test(content)
                ? content
                : `public class ${basename(relativePath, ".java")} {\n${content}\n}\n`, "java", [["javac", ["-Xlint:none"]]]);
        case "csharp":
            return runCompilerLint(content, "cs", [
                ["csc", ["/nologo", "/t:library"]],
                ["mcs", ["-target:library"]],
            ]);
        case "dart":
            return lintDart(content);
        case "go":
            return runCompilerLint(content, "go", [["gofmt", ["-e"]]]);
        case "php":
            return runCompilerLint(content, "php", [["php", ["-l"]]]);
        case "ruby":
            return runCompilerLint(content, "rb", [["ruby", ["-c"]]]);
        case "lua":
            return runCompilerLint(content, "lua", [
                ["luac", ["-p"]],
                ["lua", ["-p"]],
            ]);
        case "kotlin":
            return runCompilerLint(content, relativePath.endsWith(".kts") ? "kts" : "kt", [
                ["kotlinc", relativePath.endsWith(".kts") ? ["-script"] : []],
            ]);
        case "swift":
            return runCompilerLint(content, "swift", [["swiftc", ["-parse"]]]);
        case "scala":
            return runCompilerLint(content, "scala", [["scalac", []]]);
        case "shell":
            return runCompilerLint(content, "sh", [
                ["bash", ["-n"]],
                ["sh", ["-n"]],
            ]);
        case "perl":
            return runCompilerLint(content, "pl", [["perl", ["-c"]]]);
        case "zig":
            return runCompilerLint(content, "zig", [["zig", ["ast-check"]]]);
        case "r":
            return lintR(content);
        case "haskell":
            return runCompilerLint(content, "hs", [["ghc", ["-fno-code"]]]);
        case "elixir":
            return runCompilerLint(content, "ex", [["elixir", ["-c"]]]);
        case "clojure":
            return [];
        case "fsharp":
            return runCompilerLint(content, "fs", [["fsc", []]]);
        case "powershell":
            return lintPowerShell(content);
        default:
            return [];
    }
}
export type LintWorkspaceOptions = {
    semantic?: boolean;
};
export async function lintWorkspaceFile(workspaceRoot: string, relativePath: string, content: string, options?: LintWorkspaceOptions): Promise<{
    ok: true;
    diagnostics: LintDiagnostic[];
} | {
    ok: false;
    error: string;
}> {
    const strategy = getLintStrategy(relativePath);
    if (!strategy) {
        return { ok: true, diagnostics: [] };
    }
    try {
        let absolutePath: string;
        try {
            absolutePath = resolveWorkspacePath(workspaceRoot, relativePath);
        }
        catch {
            absolutePath = join(workspaceRoot, relativePath);
        }
        const nonAscii = lintNonAsciiIdentifiers(content, strategy, relativePath);
        const semantic = options?.semantic === true;
        const diagnostics = dedupeDiagnostics([
            ...nonAscii,
            ...(await lintByStrategy(strategy, relativePath, content, absolutePath, workspaceRoot, semantic)),
        ]);
        return { ok: true, diagnostics };
    }
    catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : "Не удалось проверить файл.",
        };
    }
}
