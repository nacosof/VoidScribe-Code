export const AGENT_TRUNCATION_USER_NOTE = "Ответ модели был обрезан. Продолжай с последнего успешного шага.";
export const AGENT_STALL_CONTINUE_NUDGE = "Ты описал будущее действие, но не вызвал инструменты. Сейчас же вызови write_file, search_replace или run_command — без «подожди» и без обещаний. Сначала tool call, потом короткий итог.";
export const AGENT_SUMMARY_AFTER_TOOLS_NUDGE = "Инструменты уже выполнены. Если задача пользователя ещё не доделана — сразу следующий tool call. Если доделана — 2–4 коротких предложения итога без новых tool calls.";
export const AGENT_STEP_LIMIT_NOTE = "Достигнут лимит шагов агента за один запрос. Увеличьте «Макс. шагов агента» в настройках или отправьте сообщение снова — агент продолжит.";
export const AGENT_CHAT_RETRIES = 2;
export const AGENT_CHAT_RETRY_DELAY_MS = 1200;
export const AGENT_MAX_STALL_CONTINUES = 3;
export const AGENT_MAX_IDENTICAL_COMMANDS = 3;
export const AGENT_COMMAND_LOOP_NOTE = "Агент несколько раз запускал одну и ту же команду без прогресса. Остановился — уточни задачу или разреши другой подход.";
export const AGENT_COMMAND_LOOP_NUDGE = "Та же команда уже выполнялась и не дала прогресса. Не повторяй её. Прочитай код/логи, измени файлы или выбери другую команду.";
export const AGENT_MISSING_PROJECT_NUDGE = "Нет package.json — npm/vite здесь бессмысленны. Сейчас же list_directory, затем scaffold: npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias \"@/*\" --turbopack --yes (или npm create vite@latest . -- --template react-ts). Потом npm install, перенеси/напиши лендинг, только потом npm run dev. Не повторяй npm run dev и не пиши один app/page.tsx без package.json.";
export const AGENT_USER_FIX_NUDGE = "Пользователь ждёт починку, а не отчёт. Сразу tool call (list_directory / read_file / run_command / write_file) — найди причину и исправь. Без «сейчас сделаю».";

export function commandCallFingerprint(argsJson: string): string {
    try {
        const args = JSON.parse(argsJson) as { command?: unknown; cwd?: unknown };
        const command = String(args.command ?? "").trim().replace(/\s+/g, " ");
        const cwd = String(args.cwd ?? ".").trim() || ".";
        return `${cwd}::${command}`.toLowerCase();
    }
    catch {
        return argsJson.trim().toLowerCase();
    }
}
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function createAssistantTextStreamer(onTextDelta: (delta: string) => void): {
    push(text: string): void;
    reset(): void;
} {
    let emitted = "";
    return {
        push(text: string) {
            if (!text)
                return;
            if (text.startsWith(emitted)) {
                const delta = text.slice(emitted.length);
                emitted = text;
                if (delta)
                    onTextDelta(delta);
            }
            else {
                emitted += text;
                onTextDelta(text);
            }
        },
        reset() { emitted = ""; },
    };
}
export function getLastUserMessageText(messages: Array<{
    role?: string;
    content?: unknown;
}>): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const msg = messages[index];
        if (msg?.role !== "user")
            continue;
        const content = msg.content;
        if (typeof content === "string")
            return content;
        if (Array.isArray(content)) {
            return content.map((part) => typeof part === "object" && part && "text" in part ? String((part as {
                text?: string;
            }).text ?? "") : "").join("\n");
        }
    }
    return "";
}
export function isRateLimitError(err: unknown): boolean {
    const status = typeof err === "object" && err !== null ? (err as {
        status?: number;
    }).status : undefined;
    return status === 429 || /rate.?limit|too many requests/i.test(String((err as Error)?.message ?? err));
}
export function rateLimitBackoffMs(attempt: number): number {
    return Math.min(10000, 1500 * (attempt + 1));
}
export function isToolCallGenerationError(err: unknown): boolean {
    return /tool|function|json/i.test(String((err as Error)?.message ?? err));
}
export function buildTruncationNudge(path?: string | null): string {
    return path ? `Файл ${path} был обрезан, продолжи с read_file.` : AGENT_TRUNCATION_USER_NOTE;
}
const STALL_REPLY_RE = /(?:подожди|подождите|секунд|минут|минуту|минуты|через\s+\d|жди\b|скоро\s+сделаю|сейчас\s+(?:полностью\s+)?(?:перепишу|исправлю|сделаю|заменю|обновлю|удалю)|wait\s+(?:\d+|a\s+(?:moment|minute|second))|i(?:'|')ll\s+(?:now\s+)?(?:rewrite|fix|update|replace)|let\s+me\s+(?:now\s+)?(?:rewrite|fix|update|replace))/i;
export function looksLikeStalledAgentReply(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed)
        return false;
    if (STALL_REPLY_RE.test(trimmed))
        return true;
    return (/(?:write_file|search_replace|run_command)/i.test(trimmed) &&
        /(?:сейчас|следующ|потом|затем|далее|now|next|then)/i.test(trimmed));
}
/** User is complaining / asking to fix a broken run — text-only replies are not enough. */
export function userWantsRuntimeFix(text: string): boolean {
    return /почин|исправ|не\s+работа|нихуя|enoent|connection\s*refused|не\s+открыв|не\s+запуска|упал|сломал|почему\s+(он|это|агент)|ало|продолж|сайт\s+то|сделай\s+сайт|запусти/i.test(text.trim());
}
export function replyLooksLikeFinishedWithUrl(text: string): boolean {
    return /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/i.test(text);
}
export function toolTextMissingPackageJson(text: string): boolean {
    return /нет package\.json|ENOENT.*package\.json|could not read package\.json|npm error code enoent/i.test(text);
}
export function batchNeedsUserSummary(calls: Array<{
    name: string;
}>): boolean {
    const actionable = new Set(["write_file", "search_replace", "delete_path", "run_command", "restore_file"]);
    return calls.some((call) => actionable.has(call.name));
}
