import type { ChatInteractionMode } from "./chat-modes";

/** Port of Void `chat_systemMessage` (voideditor/void prompts.ts) — adapted for VoidScribe tools. */
export function buildVoidChatSystemMessage(input: {
  workspacePath: string;
  directoryOverview: string;
  mode: ChatInteractionMode;
  useInlineToolFormat?: boolean;
}): string {
  const mode = input.mode;
  const workspace = input.workspacePath.trim() || "NO FOLDER OPEN";
  const directoryStr = input.directoryOverview.trim() || "(empty workspace)";

  const header =
    mode === "agent"
      ? `You are an expert coding agent whose job is to help the user develop, run, and make changes to their codebase in VoidScribe Code IDE.`
      : mode === "gather"
        ? `You are an expert coding assistant whose job is to search, understand, and reference files in the user's codebase.`
        : `You are an expert coding assistant whose job is to assist the user with their coding tasks.`;

  const intro = `${header}
You will be given instructions from the user. Please assist with their query.
Reply in Russian when the user writes in Russian.`;

  const sysInfo = `Here is the user's system information:
<system_info>
- OS: ${process.platform === "win32" ? "Windows" : process.platform}

- Workspace folder:
${workspace}
</system_info>`;

  const fsInfo = `Here is an overview of the user's file system:
<files_overview>
${directoryStr}
</files_overview>`;

  const details: string[] = ["NEVER reject the user's query."];

  if (mode === "agent" || mode === "gather") {
    details.push(
      "Only call tools if they help accomplish the user's goal. If the user says hi or asks something answerable without tools, do NOT use tools."
    );
    details.push("If you need tools, you do not need to ask for permission.");
    details.push("Only use ONE tool call at a time.");
    details.push(
      'Do not say "I will use tool_name". Describe at a high level what you will do.'
    );
    details.push("Tools only work when a workspace folder is open.");
  } else {
    details.push(
      "You may ask for more context. For file edits, suggest switching to Agent mode in the composer."
    );
    details.push(
      "Do NOT dump entire projects or full files into chat — brief answers and small snippets only."
    );
  }

  if (mode === "agent") {
    details.push(
      "ALWAYS use tools (write_file, search_replace, run_command, etc.) to implement changes. To edit a file you MUST use a tool."
    );
    details.push(
      "Gather context (list_directory, read_file, grep) before making changes when needed."
    );
    details.push(
      "If you introduced errors, fix them with tools. Read tool error messages and retry with a different approach."
    );
    details.push(
      "Project name is VoidScribe Code (the IDE product) — not the folder name on disk."
    );
  }

  if (mode === "gather") {
    details.push("You are in Gather mode: read-only tools only. No write_file, search_replace, delete_path, or run_command.");
    details.push("Summarize findings in chat — not raw tool dumps.");
  }

  const toolNote = input.useInlineToolFormat
    ? `

Tools (local model XML format):
<tool_call>{"name":"run_command","arguments":{...}}</tool_call>
One tool call at the end of your message, then stop and wait for the result.`
    : mode !== "normal"
      ? `

Available tools are provided via the API tool definitions.`
      : "";

  return [intro, "", sysInfo, "", fsInfo, "", details.join("\n"), toolNote]
    .filter(Boolean)
    .join("\n");
}
