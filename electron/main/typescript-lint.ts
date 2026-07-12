import { createRequire } from "node:module";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import type { LintDiagnostic } from "./linter";

const require = createRequire(import.meta.url);

type TsModule = typeof import("typescript");

const tsconfigCache = new Map<string, {
    mtimeMs: number;
    options: import("typescript").CompilerOptions;
    fileNames: string[];
    allowJs: boolean;
}>();

function loadTypescript(workspaceRoot: string): TsModule {
    const userTs = join(workspaceRoot, "node_modules", "typescript");
    if (existsSync(join(userTs, "package.json"))) {
        return require(userTs) as TsModule;
    }
    return require("typescript") as TsModule;
}

function normalizeFsPath(path: string): string {
    return resolve(path).replace(/\\/g, "/").toLowerCase();
}

function samePath(a: string, b: string): boolean {
    return normalizeFsPath(a) === normalizeFsPath(b);
}

function isJavaScriptLike(relativePath: string): boolean {
    return /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/i.test(relativePath);
}

function scriptKindForPath(ts: TsModule, relativePath: string): import("typescript").ScriptKind {
    const lower = relativePath.toLowerCase();
    if (lower.endsWith(".tsx"))
        return ts.ScriptKind.TSX;
    if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts"))
        return ts.ScriptKind.TS;
    if (lower.endsWith(".jsx"))
        return ts.ScriptKind.JSX;
    return ts.ScriptKind.JS;
}

function diagnosticSeverity(ts: TsModule, category: number): LintDiagnostic["severity"] {
    if (category === ts.DiagnosticCategory.Warning)
        return "warning";
    if (category === ts.DiagnosticCategory.Error)
        return "error";
    if (category === ts.DiagnosticCategory.Message)
        return "info";
    return "hint";
}

function flattenMessage(ts: TsModule, message: import("typescript").DiagnosticMessageChain | string): string {
    return typeof message === "string"
        ? message
        : ts.flattenDiagnosticMessageText(message, "\n");
}

function toLintDiagnostic(ts: TsModule, diagnostic: import("typescript").Diagnostic): LintDiagnostic | null {
    const message = flattenMessage(ts, diagnostic.messageText).trim();
    if (!message)
        return null;
    const severity = diagnosticSeverity(ts, diagnostic.category);
    if (diagnostic.file && diagnostic.start !== undefined) {
        const start = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const endPos = diagnostic.length
            ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start + diagnostic.length)
            : start;
        return {
            line: start.line + 1,
            column: start.character,
            endColumn: Math.max(start.character + 1, endPos.character + 1),
            severity,
            message,
        };
    }
    return {
        line: 1,
        column: 0,
        endColumn: 1,
        severity,
        message,
    };
}

function findTsConfigPath(ts: TsModule, absolutePath: string, workspaceRoot: string): string | undefined {
    let dir = dirname(absolutePath);
    const root = resolve(workspaceRoot);
    while (true) {
        const candidate = join(dir, "tsconfig.json");
        if (existsSync(candidate))
            return candidate;
        if (samePath(dir, root))
            break;
        const parent = dirname(dir);
        if (samePath(parent, dir))
            break;
        dir = parent;
    }
    return ts.findConfigFile(dirname(absolutePath), ts.sys.fileExists, "tsconfig.json");
}

function readTsConfig(ts: TsModule, configPath: string) {
    const stat = require("fs").statSync(configPath);
    const cached = tsconfigCache.get(configPath);
    if (cached && cached.mtimeMs === stat.mtimeMs)
        return cached;
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error)
        return null;
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath), {}, configPath);
    const entry = {
        mtimeMs: stat.mtimeMs,
        options: parsed.options,
        fileNames: parsed.fileNames,
        allowJs: Boolean(parsed.options.allowJs),
    };
    tsconfigCache.set(configPath, entry);
    return entry;
}

export function lintTypeScriptSemantics(workspaceRoot: string, relativePath: string, content: string): LintDiagnostic[] {
    if (!isJavaScriptLike(relativePath))
        return [];
    const ts = loadTypescript(workspaceRoot);
    const absolutePath = resolve(workspaceRoot, relativePath);
    const isTypedScript = /\.(tsx?|mts|cts)$/i.test(relativePath);
    const configPath = findTsConfigPath(ts, absolutePath, workspaceRoot);
    let options: import("typescript").CompilerOptions = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        strict: false,
        skipLibCheck: true,
        noEmit: true,
    };
    let rootNames = [absolutePath];
    if (configPath) {
        const config = readTsConfig(ts, configPath);
        if (!config)
            return [];
        if (!isTypedScript && !config.allowJs)
            return [];
        options = { ...config.options, noEmit: true, skipLibCheck: true };
        rootNames = config.fileNames.some((file) => samePath(file, absolutePath))
            ? config.fileNames
            : [...config.fileNames, absolutePath];
    }
    else if (!isTypedScript) {
        return [];
    }
    const host = ts.createCompilerHost(options);
    const readFile = host.readFile.bind(host);
    host.readFile = (fileName) => {
        if (samePath(fileName, absolutePath))
            return content;
        return readFile(fileName);
    };
    host.getCurrentDirectory = () => workspaceRoot;
    const program = ts.createProgram(rootNames, options, host);
    let sourceFile = program.getSourceFile(absolutePath);
    if (!sourceFile) {
        sourceFile = ts.createSourceFile(absolutePath, content, options.target ?? ts.ScriptTarget.ES2022, true, scriptKindForPath(ts, relativePath));
    }
    const diagnostics = [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile),
    ];
    const results: LintDiagnostic[] = [];
    for (const diagnostic of diagnostics) {
        if (diagnostic.file && !samePath(diagnostic.file.fileName, absolutePath))
            continue;
        const item = toLintDiagnostic(ts, diagnostic);
        if (item)
            results.push(item);
    }
    return results;
}
