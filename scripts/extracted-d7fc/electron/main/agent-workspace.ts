import { readdir, stat } from "fs/promises";
import { join } from "path";
import {
  assertWorkspaceRoot,
  listWorkspaceDirectory,
  resolveWorkspacePath,
} from "./workspace";

export const AGENT_SHELL_RULES = `

ТЕРМИНАЛ (run_command):
- Каждый вызов run_command — НОВАЯ сессия. cd из прошлого вызова НЕ сохраняется.
- Чтобы выполнить npm в подпапке — передай параметр cwd (например cwd: "voidscribe-code"), а не отдельную команду cd.
- На Windows (PowerShell 5): не используй && — только «;» в одной команде: Set-Location папка; npm run dev
- Перед npm run dev / npm install / npm run build — убедись, что package.json в этой cwd (list_directory).
- create-next-app уже устанавливает зависимости — не запускай npm install сразу после, если не было ошибки установки.
- Если ENOENT package.json — сначала list_directory("."), найди где лежит package.json, затем cwd туда.`;

export const AGENT_WORKSPACE_RULES = `

КОРЕНЬ ПРОЕКТА — открытая в IDE рабочая папка:
- Пользователь специально выбрал эту папку. Новые файлы, лендинги и проекты создавай ПРЯМО в ней, а не во вложенных папках вроде my-app/, voidscribe-code/, landing/.
- Перед созданием чего-либо всегда вызывай list_directory с path "." и смотри, что уже есть.
- Никогда не создавай два проекта с разными именами в одной папке — если первая попытка не удалась, исправь её, а не запускай create-next-app с другим именем.
- Если package.json уже есть в корне — проект уже инициализирован. Не вызывай create-next-app / npm create снова; читай и меняй существующие файлы.

Инициализация в текущей папке (пустой корень):
- create-next-app: npx create-next-app@latest . --typescript --yes --eslint --tailwind --app --use-npm
- Целевая папка — точка «.», не имя подпапки и не абсолютный путь к новой директории.
- npm create / pnpm create / yarn create — тоже с «.» как целью, если корень пустой или пользователь просит «в этой папке».

Изучение существующего проекта:
- list_directory(".") → package.json, README, src/, app/, pages/, конфиги.
- read_file по ключевым файлам, затем отвечай или вноси правки в эти же пути.
- Все пути относительны к открытой рабочей папке.`;

type WorkspaceLayout = {
  isEmpty: boolean;
  hasPackageJsonRoot: boolean;
  subdirsWithPackageJson: string[];
};

async function scanWorkspaceLayout(
  workspaceRoot: string
): Promise<WorkspaceLayout> {
  const root = assertWorkspaceRoot(workspaceRoot);
  const entries = await readdir(root, { withFileTypes: true });
  const names = entries.map((entry) => entry.name);
  const hasPackageJsonRoot = names.includes("package.json");
  const subdirsWithPackageJson: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    try {
      const sub = await readdir(join(root, entry.name));
      if (sub.includes("package.json")) {
        subdirsWithPackageJson.push(entry.name);
      }
    } catch {
      /* ignore */
    }
  }

  return {
    isEmpty: names.length === 0,
    hasPackageJsonRoot,
    subdirsWithPackageJson,
  };
}

async function hasPackageJsonInCwd(
  workspaceRoot: string,
  relativeCwd: string
): Promise<boolean> {
  try {
    const dir = resolveWorkspacePath(workspaceRoot, relativeCwd || ".");
    await stat(join(dir, "package.json"));
    return true;
  } catch {
    return false;
  }
}

function targetsCurrentDirectory(command: string): boolean {
  return /\s\.\s*(--|$)/.test(command) || /\s\.\s/.test(command);
}

function isScaffoldCommand(command: string): boolean {
  return /create-next-app|npm create\s|pnpm create\s|yarn create\s/i.test(
    command
  );
}

function isPackageManagerCommand(command: string): boolean {
  return /^(npm|pnpm|yarn)\s/i.test(command) && !/^npm create\s/i.test(command);
}

export async function getWorkspaceContextForAgent(
  workspaceRoot: string
): Promise<string> {
  const root = assertWorkspaceRoot(workspaceRoot);

  try {
    const listing = await listWorkspaceDirectory(workspaceRoot, ".");
    const layout = await scanWorkspaceLayout(workspaceRoot);
    const hints: string[] = [];

    if (layout.isEmpty) {
      hints.push(
        "Корень пустой — разворачивай проект здесь (create-next-app с «.»), не создавай подпапку."
      );
    }
    if (layout.hasPackageJsonRoot) {
      hints.push(
        "package.json в корне уже есть — работай с этим проектом, не создавай второй и не запускай create-next-app."
      );
    }
    if (
      !layout.hasPackageJsonRoot &&
      layout.subdirsWithPackageJson.length === 1
    ) {
      const sub = layout.subdirsWithPackageJson[0]!;
      hints.push(
        `package.json только в подпапке «${sub}/» — для npm-команд используй cwd: «${sub}». Лучше в будущем создавать проект сразу в корне (create-next-app .).`
      );
    }
    if (
      !layout.hasPackageJsonRoot &&
      layout.subdirsWithPackageJson.length > 1
    ) {
      hints.push(
        `package.json в подпапках: ${layout.subdirsWithPackageJson.join(", ")}. Укажи cwd явно.`
      );
    }

    return `

--- Состояние открытой рабочей папки ---
Абсолютный путь: ${root}

${listing}
${hints.length ? `\n${hints.join("\n")}` : ""}
--- конец снимка ---`;
  } catch {
    return `\nРабочая папка: ${root}\n`;
  }
}

export async function validateAgentCommand(
  workspaceRoot: string,
  command: string,
  relativeCwd = "."
): Promise<string | null> {
  const trimmed = command.trim();
  const cwd = relativeCwd.trim() || ".";
  if (!trimmed) return null;

  const layout = await scanWorkspaceLayout(workspaceRoot);

  if (/^cd\s+\S+$/i.test(trimmed)) {
    return (
      "cd не сохраняется между вызовами run_command. " +
      "Передай cwd в run_command или одну команду: Set-Location папка; npm install"
    );
  }

  if (isScaffoldCommand(trimmed) && layout.hasPackageJsonRoot) {
    return (
      "В корне рабочей папки уже есть package.json. Не создавай ещё один проект " +
      "(create-next-app / npm create). Сначала list_directory('.') и read_file нужных файлов."
    );
  }

  if (/create-next-app/i.test(trimmed) && !targetsCurrentDirectory(trimmed)) {
    return (
      "create-next-app с именем папки создаёт лишнюю вложенную директорию. " +
      "Пользователь открыл эту папку как корень проекта. Запусти: " +
      "npx create-next-app@latest . --typescript --yes --eslint --tailwind --app --use-npm"
    );
  }

  if (
    /npm create\s|pnpm create\s|yarn create\s/i.test(trimmed) &&
    !targetsCurrentDirectory(trimmed)
  ) {
    return (
      "Для npm/pnpm/yarn create укажи «.» как целевую папку, чтобы файлы легли в открытый корень, а не в подпапку."
    );
  }

  if (isPackageManagerCommand(trimmed)) {
    const pkgHere = await hasPackageJsonInCwd(workspaceRoot, cwd);
    if (!pkgHere) {
      if (
        cwd === "." &&
        layout.subdirsWithPackageJson.length === 1
      ) {
        const sub = layout.subdirsWithPackageJson[0]!;
        return (
          `package.json не в корне, а в «${sub}/». ` +
          `Повтори run_command с cwd: «${sub}» (не cd и не npm из корня).`
        );
      }
      return (
        "package.json не найден в указанной cwd. " +
        "Сначала list_directory('.'), найди package.json, затем укажи правильный cwd."
      );
    }

    if (
      /^npm install\s*$/i.test(trimmed) &&
      layout.hasPackageJsonRoot &&
      cwd === "."
    ) {
      try {
        const root = resolveWorkspacePath(workspaceRoot, ".");
        const entries = await readdir(root);
        if (entries.includes("node_modules")) {
          return (
            "node_modules уже есть в корне — npm install не нужен, если не было ошибки зависимостей. " +
            "Используй npm run dev / npm run build или read_file package.json."
          );
        }
      } catch {
        /* ignore */
      }
    }
  }

  return null;
}
