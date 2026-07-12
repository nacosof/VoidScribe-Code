import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { shellSpawnEnv } from "./shell-env";

const VENV_DIR_NAMES = [".venv", "venv", "env"];

export type PythonCommand = {
    command: string;
    prefix: string[];
};

const FALLBACK_PYTHON: PythonCommand[] = process.platform === "win32"
    ? [
        { command: "py", prefix: ["-3"] },
        { command: "python", prefix: [] },
        { command: "python3", prefix: [] },
    ]
    : [
        { command: "python3", prefix: [] },
        { command: "python", prefix: [] },
    ];

function venvPythonPath(venvRoot: string): string {
    return process.platform === "win32"
        ? join(venvRoot, "Scripts", "python.exe")
        : join(venvRoot, "bin", "python");
}

export function findWorkspaceVenvPython(workspaceRoot: string): string | null {
    const root = workspaceRoot.trim();
    if (!root)
        return null;
    for (const name of VENV_DIR_NAMES) {
        const candidate = venvPythonPath(join(root, name));
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}

function pythonExeFromPipLocation(pipLocation: string): string | null {
    const normalized = pipLocation.replace(/\\/g, "/");
    const venvMatch = normalized.match(/(.+\/\.venv)\/(?:lib|Lib)\/site-packages\/pip\b/i)
        ?? normalized.match(/(.+\/venv)\/(?:lib|Lib)\/site-packages\/pip\b/i)
        ?? normalized.match(/(.+\/env)\/(?:lib|Lib)\/site-packages\/pip\b/i);
    if (venvMatch) {
        const exe = venvPythonPath(venvMatch[1]!);
        return existsSync(exe) ? exe : null;
    }
    const stdMatch = normalized.match(/(.+)\/(?:lib|Lib)\/site-packages\/pip\b/i);
    if (!stdMatch)
        return null;
    const home = stdMatch[1]!;
    const unixCandidate = join(home, "bin", "python");
    if (existsSync(unixCandidate))
        return unixCandidate;
    const winCandidate = join(home, "python.exe");
    if (existsSync(winCandidate))
        return winCandidate;
    return null;
}

export function findPipOwnerPython(): string | null {
    const pipCommands = process.platform === "win32"
        ? ["pip", "pip3"]
        : ["pip3", "pip"];
    for (const pipCommand of pipCommands) {
        try {
            const output = execFileSync(pipCommand, ["-V"], {
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "ignore"],
            });
            const match = /from\s+(.+?[\\/]lib[\\/]site-packages[\\/]pip)\b/i.exec(output);
            if (!match?.[1])
                continue;
            const python = pythonExeFromPipLocation(match[1].trim());
            if (python)
                return python;
        }
        catch {
        }
    }
    return null;
}

function samePythonCommand(a: PythonCommand, b: PythonCommand): boolean {
    return a.command === b.command && a.prefix.join("\0") === b.prefix.join("\0");
}

export function resolvePythonCommands(workspaceRoot: string): PythonCommand[] {
    const commands: PythonCommand[] = [];
    const venvPython = findWorkspaceVenvPython(workspaceRoot);
    if (venvPython)
        commands.push({ command: venvPython, prefix: [] });
    const pipPython = findPipOwnerPython();
    if (pipPython && !commands.some((item) => item.command === pipPython))
        commands.push({ command: pipPython, prefix: [] });
    for (const fallback of FALLBACK_PYTHON) {
        if (!commands.some((item) => samePythonCommand(item, fallback)))
            commands.push(fallback);
    }
    return commands;
}

export function workspacePythonPathEntries(workspaceRoot: string): string[] {
    const entries = new Set<string>();
    const venvPython = findWorkspaceVenvPython(workspaceRoot);
    if (venvPython)
        entries.add(dirname(venvPython));
    const pipPython = findPipOwnerPython();
    if (pipPython)
        entries.add(dirname(pipPython));
    return [...entries];
}

export function prependPathEntries(env: NodeJS.ProcessEnv, entries: string[]): NodeJS.ProcessEnv {
    if (entries.length === 0)
        return env;
    const pathKey = typeof env.Path === "string"
        ? "Path"
        : typeof env.PATH === "string"
            ? "PATH"
            : "Path";
    const current = env[pathKey] ?? "";
    const merged = [...entries, ...current.split(";").filter(Boolean)].filter((value, index, list) => list.indexOf(value) === index).join(";");
    return { ...env, [pathKey]: merged };
}

export function shellSpawnEnvForWorkspace(workspaceRoot: string): NodeJS.ProcessEnv {
    return prependPathEntries(shellSpawnEnv(), workspacePythonPathEntries(workspaceRoot));
}
