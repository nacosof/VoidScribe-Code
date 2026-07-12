import { extractDevServerUrl, isDevServerCommand } from "./npm-project-cwd";
import { stripAnsi } from "./ansi";

export type ParsedCodeError = {
    file: string;
    line?: number;
    message: string;
    kind: "css" | "typescript" | "other";
};
function normalizeErrorPath(raw: string): string {
    const trimmed = raw.replace(/\\/g, "/").trim();
    const srcIdx = trimmed.toLowerCase().indexOf("/src/");
    if (srcIdx >= 0)
        return trimmed.slice(srcIdx + 1);
    return trimmed.replace(/^\.\//, "");
}
function dedupeErrors(errors: ParsedCodeError[]): ParsedCodeError[] {
    const seen = new Set<string>();
    const out: ParsedCodeError[] = [];
    for (const item of errors) {
        const key = `${item.file}:${item.line ?? 0}:${item.message.slice(0, 80)}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}
export function parseCodeErrorsFromOutput(text: string): ParsedCodeError[] {
    const errors: ParsedCodeError[] = [];
    const combined = text;
    const patterns: Array<{
        re: RegExp;
        kind: ParsedCodeError["kind"];
    }> = [
        {
            re: /([^\s"'():]+\.(?:css|scss|sass)):(\d+)(?::\d+)?[^:\n]*(?:Unclosed block|CssSyntaxError|SyntaxError)/gi,
            kind: "css",
        },
        {
            re: /CssSyntaxError:[^\n]*?([^\s"'():]+\.(?:css|scss|sass)):(\d+)/gi,
            kind: "css",
        },
        {
            re: /error TS(\d+):[^\n]*/gi,
            kind: "typescript",
        },
        {
            re: /Failed to compile[^\n]*/gi,
            kind: "other",
        },
    ];
    for (const { re, kind } of patterns) {
        for (const match of combined.matchAll(re)) {
            const file = match[1] ? normalizeErrorPath(match[1]) : undefined;
            if (!file)
                continue;
            const line = match[2] ? Number.parseInt(match[2], 10) : undefined;
            errors.push({
                file,
                line: Number.isFinite(line) ? line : undefined,
                message: match[0].trim().slice(0, 240),
                kind,
            });
        }
    }
    const fileLineRe = /([^\s"'():]+\.(?:css|scss|sass|tsx?|jsx?)):(\d+)(?::\d+)?/gi;
    for (const match of combined.matchAll(fileLineRe)) {
        const start = Math.max(0, match.index ?? 0);
        const context = combined.slice(start, start + 200);
        if (!/error|failed|syntax|unclosed|⨯/i.test(context))
            continue;
        errors.push({
            file: normalizeErrorPath(match[1]!),
            line: Number.parseInt(match[2]!, 10),
            message: context.trim().slice(0, 240),
            kind: /\.css|\.scss|\.sass/i.test(match[1]!) ? "css" : "other",
        });
    }
    if (errors.length === 0 &&
        /CssSyntaxError|Unclosed block/i.test(combined)) {
        const fileMatch = combined.match(/\.\/((?:src\/)?[\w./-]+\.(?:css|scss|sass))/i);
        if (fileMatch) {
            const lineMatch = combined.match(new RegExp(`${fileMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+)`, "i"));
            errors.push({
                file: normalizeErrorPath(fileMatch[1]!),
                line: lineMatch ? Number.parseInt(lineMatch[1]!, 10) : undefined,
                message: "CssSyntaxError / Unclosed block",
                kind: "css",
            });
        }
    }
    return dedupeErrors(errors);
}
export function stripAgentPastedLineNumbers(text: string): string {
    return text
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*\d+\|\s?/, ""))
        .join("\n");
}
export function formatFileContentForAgent(path: string, content: string): string {
    if (!content.trim()) {
        return (`--- ${path} ---\n` +
            `(файл пустой — используй write_file с полным содержимым, не search_replace и не проси текст у пользователя)`);
    }
    if (!/\.(css|scss|sass|tsx?|jsx?|ts|js|json|html?|md|vue|py)$/i.test(path)) {
        return content;
    }
    const lines = content.split(/\r?\n/);
    if (lines.length > 500)
        return content;
    const width = String(lines.length).length;
    const numbered = lines
        .map((line, index) => `${String(index + 1).padStart(width, " ")}| ${line}`)
        .join("\n");
    return (`--- ${path} (${lines.length} строк) ---\n` +
        `${numbered}\n\n` +
        `search_replace: копируй old_string БЕЗ префикса «число|» — только текст строки.`);
}
export function userIntentMentionsCodeError(userIntent: string): boolean {
    return /CssSyntaxError|Unclosed block|failed to compile|syntax error|error TS\d+/i.test(userIntent);
}
export function parseCodeErrorsFromUserIntent(userIntent: string): ParsedCodeError[] {
    return parseCodeErrorsFromOutput(userIntent);
}
export function isProductionBuildCommand(command: string): boolean {
    return /\b(npm\s+run\s+build|pnpm\s+run\s+build|yarn\s+build|next\s+build|vite\s+build)\b/i.test(command);
}
function outputIndicatesBuildSuccess(combined: string): boolean {
    return /Compiled successfully|✓ Compiled|compiled client and server successfully/i.test(combined);
}
function outputIndicatesBuildFailure(combined: string): boolean {
    if (/failed to compile|Compilation failed|⨯\s+\.\//i.test(combined))
        return true;
    if (/error TS\d+:/i.test(combined))
        return true;
    if (/npm ERR!/i.test(combined))
        return true;
    if (/CssSyntaxError:\s/i.test(combined))
        return true;
    if (/Unclosed block/i.test(combined))
        return true;
    if (/Module not found|Can't resolve/i.test(combined))
        return true;
    if (/turbopack build failed|invalid next\.config|couldn't find the next\.js package/i.test(combined)) {
        return true;
    }
    if (/ERESOLVE unable to resolve dependency tree/i.test(combined))
        return true;
    return false;
}
function nextJsToolchainAgentNote(combined: string): string {
    const notes: string[] = [];
    if (/couldn't find the next\.js package|inferred your workspace root/i.test(combined)) {
        notes.push("➡️ Next.js / Turbopack: корень проекта определён неверно или нет node_modules.\n" +
            "1) run_command: npm install (если ERESOLVE с eslint — в package.json поставь eslint ^9 для eslint-config-next@16).\n" +
            "2) read_file next.config.mjs → write_file: убери experimental.turbo; добавь turbopack.root = __dirname (через path + fileURLToPath в .mjs).\n" +
            "3) run_command: npm run build — для проверки, не npm run dev.");
    }
    else if (/invalid next\.config|unrecognized key.*turbo/i.test(combined)) {
        notes.push("➡️ Next.js 16: experimental.turbo удалён. read_file next.config.mjs → убери experimental.turbo; " +
            "используй top-level turbopack: { root: __dirname } (import path, fileURLToPath). Затем npm run build.");
    }
    else if (/turbopack build failed/i.test(combined)) {
        notes.push("➡️ Turbopack build failed: прочитай путь из ошибки, read_file этот файл или next.config.mjs, исправь, npm run build.");
    }
    else if (/ERESOLVE unable to resolve dependency tree/i.test(combined)) {
        notes.push("➡️ npm install конфликт peer deps: read_file package.json → search_replace версии (Next 16: eslint ^9 с eslint-config-next), затем npm install снова.");
    }
    if (/ENOENT.*package\.json|could not read package\.json|npm error code enoent/i.test(combined)) {
        notes.push("➡️ package.json не найден в текущей cwd. Если проект в подпапке — run_command с cwd: «имя-подпапки» для npm install / npm run dev.");
    }
    return notes.join("\n");
}
function viteReactMissingDepsNote(combined: string): string {
    if (!/TS17004|TS7026|TS2307|Cannot find module 'react'|--jsx' flag|JSX\.IntrinsicElements/i.test(combined)) {
        return "";
    }
    return "➡️ Vite/React: это НЕ ошибка синтаксиса App.tsx — нет node_modules или не выполнен npm install в cwd проекта.\n" +
        "1) run_command: npm install (cwd: подпапка с package.json).\n" +
        "2) read_file tsconfig.json — для Vite нужен \"jsx\": \"react-jsx\".\n" +
        "3) npm run build снова. ЗАПРЕЩЕНО править App.tsx из-за TS17004 / TS7026 / TS2307 react.";
}
export function isMissingNodeModulesBuildError(text: string): boolean {
    const combined = stripAnsi(text);
    return /TS17004|TS7026|Cannot find module 'react'|JSX\.IntrinsicElements|--jsx' flag/i.test(combined);
}
export function summarizeCommandFailureForUser(input: {
    command: string;
    toolText: string;
}): string {
    const combined = stripAnsi(input.toolText);
    if (isMissingNodeModulesBuildError(combined)) {
        return "Не установлены зависимости — нужен npm install в папке проекта. Это не ошибка кода лендинга.";
    }
    if (/Dev-сервер не ответил/i.test(combined)) {
        return "Dev-сервер не запустился за 2 мин. Сначала npm install, затем npm run dev из папки проекта.";
    }
    if (/ENOENT.*package\.json|npm error code enoent/i.test(combined)) {
        return "Команда запущена не из той папки — нужна подпапка с package.json.";
    }
    const tsMatch = combined.match(/error TS\d+:[^\n]+/);
    if (tsMatch) {
        const line = tsMatch[0].replace(/\s+/g, " ").trim();
        return line.length > 160 ? `${line.slice(0, 157)}…` : line;
    }
    const npmErr = combined.match(/npm ERR![^\n]+/);
    if (npmErr) {
        return npmErr[0].trim();
    }
    const compact = combined
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !/^cwd:|^exit:|^applied staged|^> /i.test(line))[0];
    return compact && compact.length <= 200
        ? compact
        : `Команда «${input.command}» завершилась с ошибкой.`;
}
function portKillAgentNote(input: {
    command: string;
    stdout: string;
    stderr: string;
    userIntent?: string;
}): string {
    const combined = `${input.stdout}\n${input.stderr}`;
    const wantsPort = /уб(ей|ить)|kill.*port|освобод|free.*port|stop.*port/i.test(input.userIntent ?? "") ||
        /findstr\s+:\d+/i.test(input.command);
    const isPortLookup = /netstat.*findstr|findstr\s+:\d+/i.test(input.command) ||
        /Get-NetTCPConnection|lsof\s+-i/i.test(input.command);
    if (!wantsPort && !isPortLookup)
        return "";
    const pidMatches = [
        ...combined.matchAll(/\sLISTENING\s+(\d+)\s*$/gim),
        ...combined.matchAll(/\s(\d+)\s*$/gm),
    ];
    const pids = [...new Set(pidMatches.map((match) => match[1]).filter(Boolean))];
    if (pids.length === 0) {
        return "ℹ️ Порт, похоже, свободен — процесс не найден. Не повторяй netstat; сообщи пользователю.";
    }
    if (process.platform === "win32") {
        return (`➡️ Следующий шаг (Windows): taskkill /PID ${pids[0]} /F` +
            (pids.length > 1 ? ` (ещё PID: ${pids.slice(1).join(", ")})` : "") +
            ". Не запускай netstat снова без taskkill.");
    }
    return (`➡️ Следующий шаг: kill -9 ${pids[0]}` +
        (pids.length > 1 ? ` (ещё PID: ${pids.slice(1).join(", ")})` : "") +
        ". Не повторяй поиск порта без завершения процесса.");
}
export function analyzeCommandOutput(input: {
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    userIntent?: string;
}): {
    success: boolean;
    errors: ParsedCodeError[];
    agentNote: string;
} {
    const combined = `${input.stdout}\n${input.stderr}`;
    const portNote = portKillAgentNote(input);
    if (isProductionBuildCommand(input.command) &&
        outputIndicatesBuildSuccess(combined) &&
        !outputIndicatesBuildFailure(combined)) {
        const notes: string[] = [];
        if (/non-standard\s+"NODE_ENV"/i.test(combined)) {
            notes.push("⚠️ Предупреждение NODE_ENV — игнорируй. Сборка прошла успешно.");
        }
        return {
            success: true,
            errors: [],
            agentNote: [portNote, ...notes].filter(Boolean).join("\n"),
        };
    }
    const outputErrors = parseCodeErrorsFromOutput(combined);
    const intentErrors = input.userIntent
        ? parseCodeErrorsFromUserIntent(input.userIntent)
        : [];
    const exitFailed = input.exitCode !== null && input.exitCode !== 0;
    const cliParseFailed = /CACError|Unused args:/i.test(combined);
    const buildSucceeded = isProductionBuildCommand(input.command) &&
        !exitFailed &&
        outputIndicatesBuildSuccess(combined) &&
        !outputIndicatesBuildFailure(combined);
    const outputFailed = !buildSucceeded &&
        (/failed to compile|⨯\s+\.\/|compilation failed/i.test(combined) ||
            outputIndicatesBuildFailure(combined));
    const hasOutputCss = outputErrors.some((item) => item.kind === "css");
    let success = buildSucceeded ||
        (!exitFailed && !cliParseFailed && !outputFailed && !hasOutputCss && !outputIndicatesBuildFailure(combined));
    if (success) {
        const notes: string[] = [];
        if (/non-standard\s+"NODE_ENV"/i.test(combined)) {
            notes.push("⚠️ Предупреждение NODE_ENV — не цель исправления. Игнорируй, если сборка прошла.");
        }
        if (isDevServerCommand(input.command)) {
            const url = extractDevServerUrl(combined);
            if (url) {
                notes.push(`✅ Сайт доступен: ${url} — напиши пользователю эту ссылку простым языком.`);
            }
        }
        if (input.userIntent &&
            userIntentMentionsCodeError(input.userIntent) &&
            intentErrors.length > 0) {
            const fromUser = intentErrors[0]!;
            notes.push(`ℹ️ Сборка прошла без ошибок. Ранее в чате была ${fromUser.file}` +
                `${fromUser.line ? `:${fromUser.line}` : ""} — если страница всё ещё падает, проверь dev-сервер отдельно.`);
        }
        return {
            success: true,
            errors: outputErrors,
            agentNote: [portNote, notes.join("\n")].filter(Boolean).join("\n"),
        };
    }
    const primary = outputErrors[0];
    const nextNote = nextJsToolchainAgentNote(combined);
    const viteNote = viteReactMissingDepsNote(combined);
    if (viteNote) {
        return {
            success: false,
            errors: outputErrors,
            agentNote: [nextNote, viteNote].filter(Boolean).join("\n"),
        };
    }
    if (primary) {
        const lineHint = primary.line
            ? `строка ${primary.line} (прочитай ±15 строк вокруг)`
            : "найди строку из ошибки";
        return {
            success: false,
            errors: outputErrors,
            agentNote: [nextNote, `🔴 СБОРКА/СТИЛИ НЕ ИСПРАВЛЕНЫ. Игнорируй NODE_ENV — это не причина.\n` +
                    `Файл: ${primary.file}, ${lineHint}.\n` +
                    `Проблема: ${primary.message}\n` +
                    `Действие: read_file → найди незакрытый блок { } → search_replace с ТОЧНЫМ текстом из read_file (с номерами строк) или write_file хвост файла.`]
                .filter(Boolean)
                .join("\n"),
        };
    }
    const devTimeoutNote = isDevServerCommand(input.command) &&
        /Dev-сервер не ответил/i.test(combined)
        ? "ℹ️ npm run build — одноразовая проверка (exit 0 = код компилируется). npm run dev — долгий процесс: VoidScribe ждёт Local: http://localhost… в выводе. " +
            "Если build ok, а dev timeout — проверь cwd (подпапка с package.json), npm install, stderr выше; можно npx vite --host."
        : "";
    return {
        success: false,
        errors: outputErrors,
        agentNote: [
            portNote,
            nextNote,
            devTimeoutNote,
            `🔴 Команда завершилась с ошибкой (exit ${input.exitCode ?? "?"}). ` +
                (exitFailed && /build|compile/i.test(input.command)
                    ? "Прочитай stderr выше, исправь файл из ошибки (search_replace или write_file), затем build снова. "
                    : "") +
                "Не повторяй ту же команду без правки файлов.",
        ]
            .filter(Boolean)
            .join("\n"),
    };
}
