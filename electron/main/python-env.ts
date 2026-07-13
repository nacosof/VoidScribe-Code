import { execFileSync } from "child_process";
import { existsSync, readdirSync, realpathSync, statSync } from "fs";
import { homedir } from "os";
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

function isPythonBinaryName(name: string): boolean {
    const base = name.replace(/\.exe$/i, "");
    if (/config$/i.test(base))
        return false;
    return /^python(\d+(\.\d+)*)?m?$/i.test(base);
}

function resolveRealPath(path: string): string {
    try {
        return realpathSync(path);
    }
    catch {
        return path;
    }
}

function collectPythonBinsFromDir(dir: string, into: Set<string>): void {
    if (!existsSync(dir))
        return;
    let entries: string[];
    try {
        entries = readdirSync(dir);
    }
    catch {
        return;
    }
    for (const name of entries) {
        if (!isPythonBinaryName(name))
            continue;
        const full = join(dir, name);
        try {
            const st = statSync(full);
            if (!st.isFile() && !st.isSymbolicLink())
                continue;
        }
        catch {
            continue;
        }
        into.add(resolveRealPath(full));
    }
}

function unixSearchRoots(): string[] {
    const home = homedir();
    const roots = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        join(home, ".local", "bin"),
        join(home, "miniconda3", "bin"),
        join(home, "anaconda3", "bin"),
        join(home, "mambaforge", "bin"),
        join(home, "miniforge3", "bin"),
    ];
    const pyenvVersions = join(home, ".pyenv", "versions");
    if (existsSync(pyenvVersions)) {
        try {
            for (const version of readdirSync(pyenvVersions))
                roots.push(join(pyenvVersions, version, "bin"));
        }
        catch {
        }
    }
    const frameworks = "/Library/Frameworks/Python.framework/Versions";
    if (existsSync(frameworks)) {
        try {
            for (const version of readdirSync(frameworks)) {
                if (version === "Current")
                    continue;
                roots.push(join(frameworks, version, "bin"));
            }
        }
        catch {
        }
    }
    return roots;
}

function discoverWindowsPyLauncher(): string[] {
    const found: string[] = [];
    try {
        const output = execFileSync("py", ["-0p"], {
            encoding: "utf8",
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"],
            env: shellSpawnEnv(),
        });
        for (const line of output.split(/\r?\n/)) {
            const trimmed = line.trim();
            const match = /([A-Za-z]:\\[^:\r\n]+\.exe)\s*$/i.exec(trimmed);
            if (match?.[1] && existsSync(match[1]))
                found.push(resolveRealPath(match[1]));
        }
    }
    catch {
    }
    return found;
}

function windowsSearchRoots(): string[] {
    const home = homedir();
    const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    const roots = [
        join(local, "Programs", "Python"),
        "C:\\Python",
        "C:\\Program Files\\Python",
        "C:\\Program Files (x86)\\Python",
    ];
    const expanded: string[] = [];
    for (const root of roots) {
        if (!existsSync(root))
            continue;
        try {
            for (const entry of readdirSync(root)) {
                const candidate = join(root, entry);
                expanded.push(candidate);
                expanded.push(join(candidate, "Scripts"));
            }
        }
        catch {
            expanded.push(root);
        }
    }
    return expanded;
}

function whichAll(names: string[]): string[] {
    if (process.platform === "win32")
        return [];
    const found: string[] = [];
    for (const name of names) {
        try {
            const output = execFileSync("which", ["-a", name], {
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "ignore"],
                env: shellSpawnEnv(),
            });
            for (const line of output.split(/\r?\n/)) {
                const path = line.trim();
                if (path && existsSync(path))
                    found.push(resolveRealPath(path));
            }
        }
        catch {
        }
    }
    return found;
}

function discoverInstalledPythonExecutables(): string[] {
    const found = new Set<string>();
    if (process.platform === "win32") {
        for (const path of discoverWindowsPyLauncher())
            found.add(path);
        for (const root of windowsSearchRoots())
            collectPythonBinsFromDir(root, found);
    }
    else {
        for (const root of unixSearchRoots())
            collectPythonBinsFromDir(root, found);
        for (const path of whichAll(["python3", "python", "python2"]))
            found.add(path);
    }
    return [...found];
}

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
    const venvPython = findWorkspaceVenvPython(workspaceRoot);
    if (venvPython)
        return [{ command: venvPython, prefix: [] }];

    const commands: PythonCommand[] = [];
    const seen = new Set<string>();
    const push = (item: PythonCommand) => {
        const key = `${item.command}\0${item.prefix.join("\0")}`;
        if (seen.has(key))
            return;
        seen.add(key);
        commands.push(item);
    };

    for (const executable of discoverInstalledPythonExecutables())
        push({ command: executable, prefix: [] });

    const pipPython = findPipOwnerPython();
    if (pipPython)
        push({ command: pipPython, prefix: [] });

    for (const fallback of FALLBACK_PYTHON)
        push(fallback);

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
