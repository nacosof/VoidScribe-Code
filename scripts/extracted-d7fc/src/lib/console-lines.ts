import { t } from "@/lib/i18n";
import type { AgentActivity, UiLanguage } from "@/types";

const TOOL_LABELS: Record<string, string> = {
  list_directory: "ls",
  read_file: "read",
  write_file: "write",
  run_command: "exec",
  list_file_history: "history",
  read_file_history: "history read",
  restore_file: "restore",
};

export function formatToolActivity(
  name: string,
  detail: string,
  lang: UiLanguage = "ru"
): string {
  if (name === "model") {
    if (detail === "__prep__") {
      return t(lang, "agentModelPrep");
    }
    const step = Number.parseInt(detail, 10);
    if (Number.isFinite(step) && step > 0) {
      return t(lang, "agentModelStep")(step);
    }
    return t(lang, "agentModelWait");
  }

  const label = TOOL_LABELS[name] ?? name;
  return `${label} ${detail}`;
}

export function activityToTerminalLines(_activity: AgentActivity): string[] {
  return [];
}
