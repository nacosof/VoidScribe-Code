import { formatToolActivity } from "@/lib/console-lines";
import { t } from "@/lib/i18n";
import type { AgentActivity, UiLanguage } from "@/types";

export type AgentStep = {
  id: string;
  label: string;
  status: "running" | "done" | "info" | "error";
  detail?: string;
  kind?: "model" | "tool" | "file" | "command" | "output";
};

function stepKey(name: string, detail: string) {
  return `${name}:${detail}`;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function completeRunningCommandStep(
  steps: AgentStep[],
  command?: string
): void {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index]!;
    if (step.detail !== "command" || step.status !== "running") continue;
    if (!command || step.label === command) {
      step.status = "done";
      return;
    }
  }
}

function completeRunningToolStep(
  steps: AgentStep[],
  name: string,
  detail: string
): boolean {
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

export function buildAgentSteps(
  activities: AgentActivity[],
  options?: { finalize?: boolean; lang?: UiLanguage }
): AgentStep[] {
  const lang = options?.lang ?? "ru";
  const steps: AgentStep[] = [];

  for (const activity of activities) {
    if (activity.type === "tool_start") {
      steps.push({
        id: stepKey(activity.name, activity.detail),
        label: formatToolActivity(activity.name, activity.detail, lang),
        status: "running",
        kind: activity.name === "model" ? "model" : "tool",
      });
      continue;
    }

    if (activity.type === "tool_done") {
      const completed = completeRunningToolStep(
        steps,
        activity.name,
        activity.detail
      );
      if (!completed) {
        steps.push({
          id: `${stepKey(activity.name, activity.detail)}:done:${steps.length}`,
          label: formatToolActivity(activity.name, activity.detail, lang),
          status: activity.detail === "ошибка" ? "error" : "done",
          kind: activity.name === "model" ? "model" : "tool",
        });
      } else if (activity.detail === "ошибка") {
        const last = [...steps]
          .reverse()
          .find(
            (step) =>
              step.id.startsWith(`${activity.name}:`) && step.status === "done"
          );
        if (last) last.status = "error";
      }

      if (activity.name === "run_command") {
        completeRunningCommandStep(
          steps,
          activity.detail === "ошибка" ? undefined : activity.detail
        );
      }
      continue;
    }

    if (activity.type === "file_change") {
      const verb =
        activity.kind === "created"
          ? t(lang, "agentFileCreated")
          : t(lang, "agentFileUpdated");
      steps.push({
        id: `file:${activity.path}:${steps.length}`,
        label: `${verb} ${activity.path}`,
        status: "done",
        kind: "file",
      });
      continue;
    }

    if (activity.type === "console_command") {
      const running = [...steps]
        .reverse()
        .find(
          (step) =>
            step.detail === "command" &&
            step.status === "running" &&
            step.label === activity.command
        );
      if (!running) {
        steps.push({
          id: `cmd:${activity.command}:${steps.length}`,
          label: activity.command,
          status: "running",
          detail: "command",
          kind: "command",
        });
      }
      continue;
    }

    if (activity.type === "console_output") {
      completeRunningCommandStep(steps);
      const text = stripAnsi(activity.text.trim());
      if (!text) continue;
      const preview =
        text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;
      steps.push({
        id: `out:${steps.length}:${preview.slice(0, 24)}`,
        label: preview,
        status: activity.stream === "stderr" ? "info" : "done",
        detail: activity.stream,
        kind: "output",
      });
    }
  }

  if (options?.finalize) {
    for (const step of steps) {
      if (step.status === "running") {
        step.status = "done";
      }
    }
  }

  return steps;
}

export function formatAgentActivitySummary(
  activities: AgentActivity[],
  lang: UiLanguage
): string | null {
  let reads = 0;
  let lists = 0;
  let writes = 0;
  let commands = 0;

  for (const activity of activities) {
    if (activity.type !== "tool_done") continue;
    if (activity.detail === "ошибка") continue;

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
  if (reads > 0) parts.push(t(lang, "agentSummaryReads")(reads));
  if (lists > 0) parts.push(t(lang, "agentSummaryLists")(lists));
  if (writes > 0) parts.push(t(lang, "agentSummaryWrites")(writes));
  if (commands > 0) parts.push(t(lang, "agentSummaryCommands")(commands));

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function getAgentLiveStatus(
  steps: AgentStep[],
  lang: UiLanguage
): string | null {
  const running = [...steps].reverse().find((step) => step.status === "running");
  if (!running) return null;
  return running.label;
}
