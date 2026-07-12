import { existsSync } from "fs";
import { join } from "path";

export function resolveWindowsPowerShell(): string {
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const candidates = [
    join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    ),
    join(
      systemRoot,
      "Sysnative",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    ),
    "powershell.exe",
  ];

  for (const candidate of candidates) {
    if (candidate === "powershell.exe") continue;
    if (existsSync(candidate)) return candidate;
  }

  return "powershell.exe";
}

export function resolveShellExecutable(): string {
  if (process.platform === "win32") {
    return resolveWindowsPowerShell();
  }
  return process.env.SHELL ?? "/bin/bash";
}

/** Electron часто стартует без System32 в PATH — child_process.spawn тогда падает ENOENT. */
export function shellSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (process.platform !== "win32") return env;

  const systemRoot = env.SystemRoot ?? "C:\\Windows";
  const extras = [
    join(systemRoot, "System32"),
    join(systemRoot, "System32", "WindowsPowerShell", "v1.0"),
    join(systemRoot, "Sysnative", "WindowsPowerShell", "v1.0"),
  ];

  const pathKey =
    typeof env.Path === "string"
      ? "Path"
      : typeof env.PATH === "string"
        ? "PATH"
        : "Path";

  const current = env[pathKey] ?? "";
  const lower = current.toLowerCase();
  const missing = extras.filter((dir) => !lower.includes(dir.toLowerCase()));
  if (missing.length > 0) {
    env[pathKey] = [...missing, current].filter(Boolean).join(";");
  }

  return env;
}

export function isShellSpawnEnoent(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT" &&
    /powershell|cmd\.exe|bash/i.test(err.message)
  );
}

export function shellSpawnEnoentMessage(): string {
  return (
    "Не удалось запустить shell (spawn ENOENT) — у процесса Electron нет powershell.exe в PATH. " +
    "Это не значит, что PowerShell или Node не установлены (терминал IDE может работать). " +
    "Используй scaffold_next_app / write_file вместо run_command, или перезапусти VoidScribe из обычного терминала."
  );
}
