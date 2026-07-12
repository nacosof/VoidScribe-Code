export type AgentEditorContext = {
    activePath?: string | null;
    openPaths?: string[];
};

export type AgentPromptOptions = {
    projectMature?: boolean;
    editorContext?: AgentEditorContext;
    osPlatform?: string;
};

function resolveOsLabel(platform?: string): string {
    if (!platform)
        return "unknown";
    if (platform === "win32")
        return "Windows";
    if (platform === "darwin")
        return "macOS";
    return platform;
}

export function formatAgentSystemInfo(input: {
    workspacePath: string;
    editorContext?: AgentEditorContext;
    osPlatform?: string;
}): string {
    const workspace = input.workspacePath.trim() || "NO FOLDER OPEN";
    const openPaths = (input.editorContext?.openPaths ?? []).filter(Boolean);
    const activePath = input.editorContext?.activePath?.trim() || "NO ACTIVE FILE";
    const openLines = openPaths.length ? openPaths.join("\n") : "NO OPENED FILES";
    return `Here is the user's system information:
<system_info>
- OS: ${resolveOsLabel(input.osPlatform)}

- Workspace folder:
${workspace}

- Active file:
${activePath}

- Open files:
${openLines}
</system_info>`;
}

function buildImportantNotes(options: {
    projectMature?: boolean;
    useInlineToolFormat?: boolean;
}): string {
    const notes: string[] = [
        "NEVER reject the user's query.",
        "Only call tools when they help. Use ONE tool call at a time.",
        "Gather context (list_directory, read_file, grep) before changes unless you already have enough certainty.",
        "Implement file changes with tools only — no code blocks in agent chat.",
        "Before edits or run_command: 1–2 sentences on what you'll check. After tools: 2–4 sentences on what you found and changed.",
        "The user describes tasks in plain language — discover paths and causes yourself.",
        "File chips (@path) already include content — do not read_file those paths again.",
        "Workspace folder only. Staged edits apply on run_command or user Accept. delete_path only when the user asked to delete.",
        "run_command cwd must be the folder with package.json. On Windows chain commands with «;», not &&.",
        "Verify edits with read_lint_errors or npm run build. Give dev URLs only from tool stdout — never guess.",
        "If the result is still wrong, investigate code before repeating the same command.",
        "Reply in Russian when the user writes in Russian.",
    ];
    if (options.projectMature) {
        notes.push("Mature project (see snapshot): edit existing files — no scaffold or create/init CLIs.");
    }
    else {
        notes.push("Empty or immature project: scaffold via official CLI only if the user asked to create a project.");
    }
    if (options.useInlineToolFormat) {
        notes.push("Local model: one XML <tool_call> at the end of the message, then wait for the result.");
    }
    return `Important notes:
${notes.map((note, index) => `${index + 1}. ${note}`).join("\n\n")}`;
}

export const LOCAL_INLINE_TOOL_RULES = `<tool_call>{"name":"write_file","arguments":{"path":"file.ts","content":"..."}}</tool_call>
Put the full file in JSON "content". After tools succeed, reply with 2–4 summary sentences (text only).`;

export function buildAgentSystemPrompt(workspacePath: string, useInlineToolFormat = false, workspaceSnapshot = "", options?: AgentPromptOptions): string {
    const workspace = workspacePath.trim();
    const snapshot = workspaceSnapshot.trim() || "(empty workspace)";
    const header = `You are an expert coding agent in VoidScribe Code IDE — help the user develop, run, and change their codebase with tools.
Assist with the user's request. VoidScribe Code is the IDE product name, not the folder on disk.`;

    const parts = [
        header,
        "",
        formatAgentSystemInfo({
            workspacePath: workspace,
            editorContext: options?.editorContext,
            osPlatform: options?.osPlatform,
        }),
        "",
        buildImportantNotes({
            projectMature: options?.projectMature,
            useInlineToolFormat,
        }),
        "",
        `Here is an overview of the user's file system:
<files_overview>
${snapshot}
</files_overview>`,
    ];
    if (useInlineToolFormat) {
        parts.push("", "Tools (local XML):", LOCAL_INLINE_TOOL_RULES);
    }
    else {
        parts.push("", "Available tools are provided via the API tool definitions.");
    }
    return parts.join("\n");
}

/** @deprecated kept for imports; rules are inlined in buildAgentSystemPrompt */
export const VOIDSCRIBE_AGENT_PERSONA = "";
export const NORMAL_CHAT_RULES = "";
export const AGENT_WORKSPACE_RULES = "";
export const AGENT_TOOLS_RULES = "";
export const AGENT_SHELL_RULES = "";
export const AGENT_IMMATURE_RULES = "";
export const AGENT_MATURE_RULES = "";
export const AGENT_EXPLORE_RULES = "";
export const AGENT_SCAFFOLD_RULES = AGENT_IMMATURE_RULES;
export const AGENT_MATURE_PROJECT_RULES = AGENT_MATURE_RULES;
export const AGENT_RUNTIME_RULES = "";
export const AGENT_MATURE_RUNTIME_RULES = "";
