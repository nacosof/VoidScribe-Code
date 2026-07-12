import { spawn } from "child_process";
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join, resolve } from "path";
import type { LintDiagnostic } from "./linter";

const VENV_DIR_NAMES = [".venv", "venv", "env", ".env"];

type RuffIssue = {
    code?: string;
    message?: string;
    location?: {
        row?: number;
        column?: number;
    };
    end_location?: {
        row?: number;
        column?: number;
    };
};

const ruffPathCache = new Map<string, string | null>();

function ruffBinaryName(): string {
    return process.platform === "win32" ? "ruff.exe" : "ruff";
}

function venvRuffPath(venvRoot: string): string {
    return process.platform === "win32"
        ? join(venvRoot, "Scripts", ruffBinaryName())
        : join(venvRoot, "bin", "ruff");
}

function findRuffInDirectory(root: string): string | null {
    for (const name of VENV_DIR_NAMES) {
        const candidate = venvRuffPath(join(root, name));
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}

function findRuffOnPath(): string | null {
    try {
        if (process.platform === "win32") {
            const output = execFileSync("where", ["ruff"], {
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "ignore"],
            }).trim();
            const first = output.split(/\r?\n/).find((line) => line.trim());
            return first && existsSync(first) ? first : null;
        }
        const output = execFileSync("which", ["ruff"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        return output && existsSync(output) ? output : null;
    }
    catch {
        return null;
    }
}

function resolveRuffExecutable(workspaceRoot: string): string | null {
    const cacheKey = resolve(workspaceRoot).toLowerCase();
    if (ruffPathCache.has(cacheKey))
        return ruffPathCache.get(cacheKey) ?? null;
    const fromWorkspace = findRuffInDirectory(workspaceRoot);
    const resolved = fromWorkspace ?? findRuffOnPath();
    ruffPathCache.set(cacheKey, resolved);
    return resolved;
}

function ruffSeverity(code: string | undefined): LintDiagnostic["severity"] {
    if (!code)
        return "error";
    if (code.startsWith("W") || code.startsWith("I") || code.startsWith("N") || code.startsWith("UP"))
        return "warning";
    return "error";
}

function parseRuffOutput(stdout: string): LintDiagnostic[] {
    const trimmed = stdout.trim();
    if (!trimmed)
        return [];
    let issues: RuffIssue[];
    try {
        issues = JSON.parse(trimmed) as RuffIssue[];
    }
    catch {
        return [];
    }
    if (!Array.isArray(issues))
        return [];
    const diagnostics: LintDiagnostic[] = [];
    for (const issue of issues) {
        const message = issue.message?.trim();
        if (!message)
            continue;
        const line = Math.max(1, issue.location?.row ?? 1);
        const column = Math.max(0, (issue.location?.column ?? 1) - 1);
        const endColumn = Math.max(column + 1, issue.end_location?.column ?? column + 1);
        const code = issue.code?.trim();
        diagnostics.push({
            line,
            column,
            endColumn,
            severity: ruffSeverity(code),
            message: code ? `[${code}] ${message}` : message,
        });
    }
    return diagnostics;
}

async function runRuffCheck(ruffPath: string, relativePath: string, content: string, cwd: string): Promise<string> {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(ruffPath, [
            "check",
            "--output-format=json",
            "--stdin-filename",
            relativePath.replace(/\\/g, "/"),
            "-",
        ], {
            cwd,
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
            stderr += chunk;
        });
        child.on("error", reject);
        child.on("close", () => {
            if (stdout.trim()) {
                resolvePromise(stdout);
                return;
            }
            if (stderr.trim()) {
                reject(new Error(stderr.trim()));
                return;
            }
            resolvePromise("[]");
        });
        child.stdin.write(content);
        child.stdin.end();
    });
}

export async function lintWithRuff(workspaceRoot: string, relativePath: string, content: string): Promise<LintDiagnostic[]> {
    const ruffPath = resolveRuffExecutable(workspaceRoot);
    if (!ruffPath)
        return [];
    try {
        const stdout = await runRuffCheck(ruffPath, relativePath, content, workspaceRoot);
        return parseRuffOutput(stdout);
    }
    catch {
        return [];
    }
}

export function clearRuffPathCache(): void {
    ruffPathCache.clear();
}
