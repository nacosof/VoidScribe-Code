import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";
export function formatToolActivity(name: string | undefined, detail: string | undefined, lang: UiLanguage = "ru", failed = false): string {
    const toolName = name ?? "tool";
    const info = (detail ?? "").trim();
    if (toolName === "model") {
        return t(lang, "agentThought");
    }
    switch (toolName) {
        case "read_file":
        case "read_file_history":
            return info ? t(lang, "agentReadFile", info) : t(lang, "agentReadFileGeneric");
        case "write_file":
        case "search_replace":
        case "restore_file":
            if (failed) {
                return info ? t(lang, "agentEditFileFailed", info) : t(lang, "agentEditFileFailedGeneric");
            }
            return info ? t(lang, "agentEditFile", info) : t(lang, "agentEditFileGeneric");
        case "list_directory":
        case "list_file_history":
            return !info || info === "."
                ? t(lang, "agentExploring")
                : t(lang, "agentListDir", info);
        case "grep":
            return info ? t(lang, "agentGrep", info) : t(lang, "agentGrepGeneric");
        case "run_command":
            return info;
        case "delete_path":
            return info ? t(lang, "agentDeletePath", info) : t(lang, "agentDeletePathGeneric");
        case "read_lint_errors":
            return t(lang, "agentReadLint");
        default:
            return info ? `${toolName} ${info}` : toolName;
    }
}
