import { readdir } from "fs/promises";
import { join } from "path";
import { resolveWorkspacePath } from "./workspace";

const PROJECT_MANIFEST_NAMES = new Set([
  "package.json",
  "pubspec.yaml",
  "cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "setup.py",
  "composer.json",
  "gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "cmakelists.txt",
]);

export const BOOTSTRAP_FILE_RE =
  /^(package\.json|pubspec\.yaml|cargo\.toml|go\.mod|pyproject\.toml|tsconfig(\.json|\.app\.json)?|tailwind\.config\.(ts|js|mjs)|next\.config\.(ts|js|mjs)|vite\.config\.(ts|js|mjs)|eslint\.config\.(mjs|js)|postcss\.config\.(mjs|js)|angular\.json|nest-cli\.json)$/i;

export type ScaffoldHint = {
  stack: string;
  command: string;
};

export function inferScaffoldHints(userIntent: string): ScaffoldHint[] {
  const msg = userIntent.toLowerCase();
  const hints: ScaffoldHint[] = [];

  if (/next(\.js)?|некст/i.test(msg)) {
    hints.push({
      stack: "Next.js",
      command:
        "npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias \"@/*\" --yes",
    });
  }
  if (/flutter|флаттер|\bdart\b/i.test(msg)) {
    hints.push({
      stack: "Flutter",
      command: "flutter create . --project-name app",
    });
  }
  if (/django|джанго/i.test(msg)) {
    hints.push({
      stack: "Django",
      command: "django-admin startproject config .",
    });
  }
  if (/fastapi|fast api|фастапи/i.test(msg)) {
    hints.push({
      stack: "FastAPI",
      command:
        "uv init; uv add fastapi uvicorn[standard]; mkdir app; write endpoints in app/ after scaffold",
    });
  }
  if (/\bvue\b/i.test(msg) && !/next/i.test(msg)) {
    hints.push({
      stack: "Vue",
      command: "npm create vue@latest . -- --default",
    });
  }
  if (/\bvite\b/i.test(msg) && !/next/i.test(msg)) {
    hints.push({
      stack: "Vite",
      command: "npm create vite@latest . -- --template react-ts",
    });
  }
  if (/\breact\b/i.test(msg) && !/next|vite|vue/i.test(msg)) {
    hints.push({
      stack: "React (Vite)",
      command: "npm create vite@latest . -- --template react-ts",
    });
  }
  if (/angular|ангуляр/i.test(msg)) {
    hints.push({
      stack: "Angular",
      command: "npx @angular/cli@latest new . --defaults --skip-git",
    });
  }
  if (/\brust\b|cargo/i.test(msg)) {
    hints.push({
      stack: "Rust",
      command: "cargo init --name app",
    });
  }
  if (/\bgo\b|golang/i.test(msg)) {
    hints.push({
      stack: "Go",
      command: "go mod init app",
    });
  }
  if (/\.net|dotnet|asp\.net|c#/i.test(msg)) {
    hints.push({
      stack: ".NET",
      command: "dotnet new webapp -o . --force",
    });
  }
  if (/laravel|php/i.test(msg)) {
    hints.push({
      stack: "Laravel",
      command: "composer create-project laravel/laravel .",
    });
  }

  return hints;
}

export async function hasMatureProjectAt(
  workspaceRoot: string,
  relativeCwd = "."
): Promise<boolean> {
  try {
    const dir = resolveWorkspacePath(workspaceRoot, relativeCwd || ".");
    const entries = await readdir(dir, { withFileTypes: true });
    const names = entries.map((entry) => entry.name);
    const lower = names.map((name) => name.toLowerCase());

    for (const sub of ["app", "lib", "src", "pages"]) {
      if (!lower.includes(sub)) continue;
      const subPath = join(dir, sub);
      const subEntries = await readdir(subPath, { withFileTypes: true });

      if (
        subEntries.some(
          (entry) =>
            entry.isFile() &&
            /\.(tsx?|jsx?|vue|dart|py|rs|go|php)$/i.test(entry.name)
        )
      ) {
        return true;
      }

      for (const entry of subEntries) {
        if (!entry.isDirectory()) continue;
        try {
          const nested = await readdir(join(subPath, entry.name));
          if (
            nested.some((file) =>
              /^(page|layout|main|index)\.(tsx?|jsx?|vue|dart)$/.test(file)
            )
          ) {
            return true;
          }
        } catch {
          /* ignore */
        }
      }
    }

    const visible = entries.filter((entry) => !entry.name.startsWith("."));
    const codeFiles = visible.filter(
      (entry) =>
        entry.isFile() &&
        /\.(tsx?|jsx?|vue|dart|py|rs|go|php)$/i.test(entry.name)
    );
    if (codeFiles.length >= 2) return true;

    if (
      lower.some((name) => PROJECT_MANIFEST_NAMES.has(name)) &&
      (lower.includes("node_modules") || visible.length >= 6)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function isBootstrapArtifactPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  const base = normalized.split("/").pop() ?? normalized;
  return BOOTSTRAP_FILE_RE.test(base) || BOOTSTRAP_FILE_RE.test(normalized);
}

export const SCAFFOLD_PRIORITY_HINT =
  "Новый/незрелый проект: сначала run_command с официальным генератором стека (create-next-app, flutter create, django-admin, npm create vite, dotnet new, cargo init …). Не пиши package.json/tsconfig/tailwind.config вручную через write_file.";

export function manualBootstrapWriteBlockedMessage(
  hints: ScaffoldHint[] = []
): string {
  const specific =
    hints.length > 0
      ? ` Под задачу: ${hints.map((h) => `${h.stack} → ${h.command}`).join(" | ")}.`
      : "";
  return (
    "Каркас проекта — через run_command (официальный CLI), не write_file." +
    specific +
    " После scaffold правь код через write_file."
  );
}
