import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { promisify } from "util";
import { app } from "electron";
import { resolveWorkspacePath } from "./workspace";
import type { LintDiagnostic, LintSeverity } from "../../src/types";

const execFileAsync = promisify(execFile);

const PYTHON_CANDIDATES = process.platform === "win32"
  ? [["py", ["-3"]], ["python"], ["python3"]]
  : [["python3"], ["python"]];

function getPythonLintScriptPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "python-lint.py");
  }
  return join(process.cwd(), "electron/main/python-lint.py");
}

function getLanguage(filePath: string): "python" | "json" | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "py" || ext === "pyw") return "python";
  if (ext === "json") return "json";
  return null;
}

async function runPythonLint(
  content: string,
  absolutePath: string,
  workspaceRoot: string
): Promise<LintDiagnostic[]> {
  const tempPath = join(
    tmpdir(),
    `voidscribe-lint-${randomBytes(8).toString("hex")}.py`
  );

  await writeFile(tempPath, content, "utf8");

  const env = {
    ...process.env,
    VOIDSCRIBE_WORKSPACE: workspaceRoot,
    PYTHONUTF8: "1",
    PYTHONIOENCODING: "utf-8",
  };

  const scriptPath = getPythonLintScriptPath();
  let lastError: unknown;

  try {
    for (const [command, prefix] of PYTHON_CANDIDATES) {
      try {
        const { stdout } = await execFileAsync(
          command,
          [...prefix, scriptPath, tempPath],
          {
            env,
            timeout: 15_000,
            maxBuffer: 1024 * 1024,
            cwd: dirname(absolutePath),
          }
        );
        const parsed = JSON.parse(stdout.trim() || "[]") as LintDiagnostic[];
        return parsed.map(normalizeDiagnostic);
      } catch (err) {
        lastError = err;
      }
    }
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }

  if (lastError) {
    const message =
      lastError instanceof Error ? lastError.message : "Python не найден";
    if (/ENOENT|not found/i.test(message)) {
      return [];
    }
  }

  return [];
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

function normalizeSeverity(value: string): LintSeverity {
  if (value === "warning" || value === "info" || value === "hint") {
    return value;
  }
  return "error";
}

function lintJson(content: string): LintDiagnostic[] {
  try {
    JSON.parse(content);
    return [];
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Некорректный JSON";
    return [
      {
        line: 1,
        column: 0,
        endColumn: 1,
        severity: "error",
        message,
      },
    ];
  }
}

export async function lintWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<{ ok: true; diagnostics: LintDiagnostic[] } | { ok: false; error: string }> {
  const language = getLanguage(relativePath);
  if (!language) {
    return { ok: true, diagnostics: [] };
  }

  try {
    const absolutePath = resolveWorkspacePath(workspaceRoot, relativePath);

    if (language === "python") {
      const diagnostics = await runPythonLint(content, absolutePath, workspaceRoot);
      return { ok: true, diagnostics };
    }

    return { ok: true, diagnostics: lintJson(content) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Не удалось проверить файл.",
    };
  }
}
