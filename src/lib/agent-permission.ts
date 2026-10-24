export type AgentPermissionMode = "read" | "ask" | "full";

export const AGENT_PERMISSION_MODES: AgentPermissionMode[] = ["read", "ask", "full"];

export function normalizeAgentPermissionMode(value: unknown): AgentPermissionMode {
    if (value === "full")
        return "full";
    if (value === "read")
        return "read";
    return "ask";
}

const READ_TOOLS = new Set([
    "list_directory",
    "read_file",
    "grep",
    "workspace_snapshot",
    "list_file_history",
    "read_file_history",
    "read_lint_errors",
    "capture_page_preview",
    "diff_files",
]);

const WRITE_TOOLS = new Set(["write_file", "search_replace", "restore_file"]);

const SHELL_OR_DANGEROUS = new Set(["run_command", "delete_path", "auto_install"]);

/**
 * read  — only reads
 * ask   — workspace writes free; shell / delete / MCP need confirmation
 * full  — everything without prompts
 */
export function permissionAllowsTool(mode: AgentPermissionMode, toolName: string): "allow" | "ask" | "deny" {
    const name = toolName.trim();
    if (READ_TOOLS.has(name))
        return "allow";
    if (mode === "full")
        return "allow";
    if (mode === "read")
        return "deny";
    // ask
    if (WRITE_TOOLS.has(name))
        return "allow";
    if (SHELL_OR_DANGEROUS.has(name))
        return "ask";
    // MCP and anything else mutating
    return "ask";
}
