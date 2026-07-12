import type OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { getMcpToolsForAgent } from "../mcp-service";
import type { ChatInteractionMode } from "../../../src/lib/chat-modes";

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });
const stringProp = (description: string) => ({ type: "string", description });

export const AGENT_TOOLS: ChatCompletionTool[] = [
    { type: "function", function: { name: "list_directory", description: "List workspace directory entries.", parameters: schema({ path: stringProp("Relative directory path, default .") }) } },
    { type: "function", function: { name: "read_file", description: "Read a UTF-8 text file from the workspace.", parameters: schema({ path: stringProp("Relative file path") }, ["path"]) } },
    { type: "function", function: { name: "write_file", description: "Create or replace a workspace file. Use the exact relative path from user context (e.g. lol.py). Never absolute paths. For empty attached files, write full content to that path.", parameters: schema({ path: stringProp("Relative file path inside workspace"), content: stringProp("Complete file content") }, ["path", "content"]) } },
    { type: "function", function: { name: "search_replace", description: "Replace an exact string in a text file.", parameters: schema({ path: stringProp("Relative file path"), old_string: stringProp("Exact old text"), new_string: stringProp("Replacement text") }, ["path", "old_string", "new_string"]) } },
    { type: "function", function: { name: "grep", description: "Search text files with a regex.", parameters: schema({ pattern: stringProp("Regex pattern"), path: stringProp("Directory path, default ."), glob: stringProp("Optional glob like *.tsx") }, ["pattern"]) } },
    { type: "function", function: { name: "run_command", description: "Run a workspace command via shell.", parameters: schema({ command: stringProp("Command to run"), cwd: stringProp("Relative cwd, default .") }, ["command"]) } },
    { type: "function", function: { name: "delete_path", description: "Delete a file or directory from workspace.", parameters: schema({ path: stringProp("Relative path") }, ["path"]) } },
    { type: "function", function: { name: "read_lint_errors", description: "Run project build/lint check and return output.", parameters: schema({}) } },
    { type: "function", function: { name: "list_file_history", description: "List snapshots recorded for files.", parameters: schema({ path: stringProp("Optional relative path") }) } },
    { type: "function", function: { name: "read_file_history", description: "Read a file history snapshot by id.", parameters: schema({ id: stringProp("History id") }, ["id"]) } },
    { type: "function", function: { name: "restore_file", description: "Restore a file from a history snapshot.", parameters: schema({ id: stringProp("History id") }, ["id"]) } },
    { type: "function", function: { name: "capture_page_preview", description: "Fetch readable preview text for an HTTP page.", parameters: schema({ url: stringProp("HTTP/HTTPS URL") }, ["url"]) } },
    { type: "function", function: { name: "workspace_snapshot", description: "Get a compact workspace tree snapshot.", parameters: schema({}) } },
];

export function getAgentToolsForMode(mode: ChatInteractionMode = "agent"): ChatCompletionTool[] {
    if (mode === "normal")
        return [];
    return [...AGENT_TOOLS, ...getMcpToolsForAgent()];
}

export type OpenAiMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
