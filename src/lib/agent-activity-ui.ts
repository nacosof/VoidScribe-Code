import { formatToolActivity } from "@/lib/console-lines";
import { t } from "@/lib/i18n";
import type { AgentActivity, UiLanguage } from "@/types";
export type UiAgentStep = {
    id: string;
    label: string;
    status: "running" | "done" | "info" | "error";
    detail?: string;
    kind?: "model" | "tool" | "file" | "command" | "output";
    error?: string;
    checkpointId?: string;
};
function stepKey(name: string, detail: string): string {
    return `${name}:${detail}`;
}
function stripAnsi(text: string): string {
    return text
        .replace(/\x1b\[[0-9;]*m/g, "")
        .replace(/\x1b\][^\x07]*\x07/g, "")
        .replace(/\r/g, "");
}
function completeRunningModelSteps(steps: UiAgentStep[]): void {
    for (const step of steps) {
        if (step.kind === "model" && step.status === "running") {
            step.status = "done";
        }
    }
}
function isLiveCommandOutput(text: string): boolean {
    return /localhost|127\.0\.0\.1|ready|vite|compiled|listening|➜|error|failed|warn|npm|starting|dev server|network:/i.test(text);
}
function upsertOutputStep(steps: UiAgentStep[], text: string, stream: "stdout" | "stderr"): void {
    const preview = text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
    const detail = stream;
    const next: UiAgentStep = {
        id: `out:${stream}:${preview.slice(0, 32)}`,
        label: preview,
        status: stream === "stderr" && /error|failed|eaddrinuse|not found/i.test(text) ? "error" : "info",
        detail,
        kind: "output",
    };
    if (stream === "stdout") {
        let lastStdoutIndex = -1;
        for (let index = steps.length - 1; index >= 0; index -= 1) {
            const step = steps[index];
            if (step?.kind === "output" && step.detail === "stdout") {
                lastStdoutIndex = index;
                break;
            }
        }
        if (lastStdoutIndex >= 0) {
            steps[lastStdoutIndex] = next;
            return;
        }
    }
    steps.push(next);
}
function completeRunningCommandStep(steps: UiAgentStep[], command?: string): void {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
        const step = steps[index]!;
        if (step.detail !== "command" || step.status !== "running")
            continue;
        if (!command || step.label === command) {
            step.status = "done";
            return;
        }
    }
}
function completeRunningToolStep(steps: UiAgentStep[], name: string, detail: string): boolean {
    if (name === "run_command")
        return false;
    const key = stepKey(name, detail);
    const exact = [...steps]
        .reverse()
        .find((step) => step.id === key && step.status === "running");
    if (exact) {
        exact.status = "done";
        return true;
    }
    const prefix = `${name}:`;
    const fallback = [...steps]
        .reverse()
        .find((step) => step.id.startsWith(prefix) && step.status === "running");
    if (fallback) {
        fallback.status = "done";
        return true;
    }
    return false;
}
export function buildAgentSteps(activities: AgentActivity[], options?: {
    finalize?: boolean;
    lang?: UiLanguage;
    hideRunningModel?: boolean;
}): UiAgentStep[] {
    const lang = options?.lang ?? "ru";
    const steps: UiAgentStep[] = [];
    for (const activity of activities) {
        if (activity.type === "model_progress")
            continue;
        if (activity.type === "tool_start") {
            if (activity.name === "run_command") {
                completeRunningModelSteps(steps);
                const command = activity.detail ?? "";
                const running = [...steps]
                    .reverse()
                    .find((step) => step.detail === "command" &&
                    step.status === "running" &&
                    step.label === command);
                if (!running && command) {
                    steps.push({
                        id: `cmd:${command}:${steps.length}`,
                        label: command,
                        status: "running",
                        detail: "command",
                        kind: "command",
                    });
                }
                continue;
            }
            completeRunningModelSteps(steps);
            if (options?.hideRunningModel && activity.name === "model")
                continue;
            steps.push({
                id: stepKey(activity.name ?? "tool", activity.detail ?? ""),
                label: formatToolActivity(activity.name, activity.detail, lang, activity.failed),
                status: "running",
                kind: activity.name === "model" ? "model" : "tool",
            });
            continue;
        }
        if (activity.type === "tool_done") {
            const completed = completeRunningToolStep(steps, activity.name ?? "tool", activity.detail ?? "");
            if (!completed) {
                steps.push({
                    id: `${stepKey(activity.name ?? "tool", activity.detail ?? "")}:done:${steps.length}`,
                    label: formatToolActivity(activity.name, activity.detail, lang, activity.failed),
                    status: activity.failed || activity.detail === "ошибка" ? "error" : "done",
                    kind: activity.name === "model" ? "model" : "tool",
                    error: activity.error,
                });
            }
            else if (activity.failed || activity.detail === "ошибка") {
                const last = [...steps]
                    .reverse()
                    .find((step) => step.id.startsWith(`${activity.name ?? "tool"}:`) &&
                    (step.status === "done" || step.status === "running"));
                if (last) {
                    last.status = "error";
                    last.error = activity.error;
                }
            }
            if (activity.name === "run_command") {
                completeRunningCommandStep(steps, activity.failed || activity.detail === "ошибка" ? undefined : activity.detail);
            }
            continue;
        }
        if (activity.type === "file_change") {
            const verb = activity.kind === "created"
                ? t(lang, "agentFileCreated")
                : activity.kind === "deleted"
                    ? t(lang, "agentFileDeleted")
                    : t(lang, "agentFileUpdated");
            steps.push({
                id: `file:${activity.path}:${steps.length}`,
                label: `${verb} ${activity.path}`,
                status: "done",
                kind: "file",
                checkpointId: activity.checkpointId,
            });
            continue;
        }
        if (activity.type === "console_command") {
            completeRunningModelSteps(steps);
            const running = [...steps]
                .reverse()
                .find((step) => step.detail === "command" &&
                step.status === "running" &&
                step.label === activity.command);
            if (!running) {
                steps.push({
                    id: `cmd:${activity.command}:${steps.length}`,
                    label: activity.command ?? "",
                    status: "running",
                    detail: "command",
                    kind: "command",
                });
            }
            continue;
        }
        if (activity.type === "console_output") {
            const text = stripAnsi(activity.text?.trim() ?? "");
            if (!text)
                continue;
            const stream = activity.stream === "stderr" ? "stderr" : "stdout";
            if (stream === "stdout" && !isLiveCommandOutput(text))
                continue;
            upsertOutputStep(steps, text, stream);
        }
    }
    if (options?.finalize) {
        for (const step of steps) {
            if (step.status === "running")
                step.status = "done";
        }
    }
    return steps;
}
export function isCommandStep(step: UiAgentStep): boolean {
    return step.kind === "command" && Boolean(step.label);
}
export function formatAgentActivitySummary(activities: AgentActivity[], lang: UiLanguage): string | null {
    let reads = 0;
    let lists = 0;
    let writes = 0;
    let commands = 0;
    for (const activity of activities) {
        if (activity.type !== "tool_done")
            continue;
        if (activity.failed || activity.detail === "ошибка")
            continue;
        switch (activity.name) {
            case "read_file":
            case "read_file_history":
                reads += 1;
                break;
            case "list_directory":
            case "list_file_history":
                lists += 1;
                break;
            case "write_file":
            case "search_replace":
            case "restore_file":
                writes += 1;
                break;
            case "run_command":
                commands += 1;
                break;
            default:
                break;
        }
    }
    const parts: string[] = [];
    if (reads > 0)
        parts.push(t(lang, "agentSummaryReads", reads));
    if (lists > 0)
        parts.push(t(lang, "agentSummaryLists", lists));
    if (writes > 0)
        parts.push(t(lang, "agentSummaryWrites", writes));
    if (commands > 0)
        parts.push(t(lang, "agentSummaryCommands", commands));
    return parts.length > 0 ? parts.join(" · ") : null;
}
export function formatAgentCompletionMessage(activities: AgentActivity[], lang: UiLanguage): string | null {
    const fileChanges = activities.filter((activity) => activity.type === "file_change" && activity.path);
    const devRuns = activities.filter((activity) => activity.type === "tool_done" &&
        activity.name === "run_command" &&
        !activity.failed &&
        /dev|vite|next dev/i.test(activity.detail ?? ""));
    const reads = activities.filter((activity) => activity.type === "tool_done" &&
        activity.name === "read_file" &&
        !activity.failed);
    if (!fileChanges.length && !devRuns.length)
        return null;
    const lines: string[] = [];
    for (const activity of fileChanges) {
        const path = activity.path!;
        if (activity.kind === "created") {
            lines.push(lang === "ru" ? `• создан \`${path}\`` : `• created \`${path}\``);
        }
        else if (activity.kind === "deleted") {
            lines.push(lang === "ru" ? `• удалён \`${path}\`` : `• deleted \`${path}\``);
        }
        else {
            lines.push(lang === "ru" ? `• изменён \`${path}\`` : `• updated \`${path}\``);
        }
    }
    if (devRuns.length) {
        const commands = [...new Set(devRuns.map((activity) => activity.detail).filter(Boolean))];
        const label = lang === "ru" ? "• перезапущен dev-сервер" : "• restarted dev server";
        lines.push(`${label}: ${commands.join(", ")}`);
    }
    if (reads.length) {
        const paths = [...new Set(reads.map((activity) => activity.detail).filter(Boolean))];
        lines.push(lang === "ru"
            ? `• прочитаны файлы: ${paths.join(", ")}`
            : `• read files: ${paths.join(", ")}`);
    }
    const header = lang === "ru"
        ? "Агент выполнил действия, но не объяснил результат:"
        : "The agent ran tools but did not explain the outcome:";
    const footer = lang === "ru"
        ? "\n\nСпросите агента: «что ты изменил и зачем?» — если ответ непонятен."
        : "\n\nAsk the agent what it changed and why if the answer is unclear.";
    return `${header}\n\n${lines.join("\n")}${footer}`;
}
export function getRunningAgentStep(steps: UiAgentStep[]): UiAgentStep | null {
    return steps.find((step) => step.status === "running") ?? null;
}
export function getLiveThoughtStep(steps: UiAgentStep[]): UiAgentStep | null {
    const busy = steps.some((step) => step.status === "running" && step.kind !== "model");
    if (busy)
        return null;
    const runningModels = steps.filter((step) => step.kind === "model" && step.status === "running");
    return runningModels[runningModels.length - 1] ?? null;
}
export function resolveStreamingIndicator(items: AgentActivity[], isLive: boolean, lang: UiLanguage = "ru"): {
    label: string;
    elapsedKey: string;
} | null {
    if (!isLive)
        return null;
    const steps = buildAgentSteps(items, { lang });
    const runningCommand = steps.find((step) => step.kind === "command" && step.status === "running");
    if (runningCommand?.label) {
        return { label: runningCommand.label, elapsedKey: `cmd:${runningCommand.id}` };
    }
    const runningTool = steps.find((step) => step.status === "running" && step.kind === "tool");
    if (runningTool) {
        return { label: runningTool.label, elapsedKey: `tool:${runningTool.id}` };
    }
    return { label: t(lang, "agentThought"), elapsedKey: "thinking" };
}
export function formatAgentElapsed(ms: number): string {
    return `${Math.max(1, Math.floor(ms / 1000))}s`;
}
