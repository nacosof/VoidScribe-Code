import fs from "fs";

const bundle = fs.readFileSync("out/main/index.js", "utf8");
const start = bundle.indexOf("const MAX_WRITE_FILE_LINES");
const end = bundle.indexOf("async function runAgentToolLoop");
const body = bundle.slice(start, end);

const header = `import type OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  deleteWorkspaceFile,
  deleteWorkspaceEntry,
  diffWorkspaceTextSnapshots,
  listWorkspaceDirectory,
  normalizeAgentRelativePath,
  readWorkspaceFileIfExists,
  resolveWorkspacePath,
  snapshotWorkspaceTextFiles,
  writeWorkspaceFile,
  WorkspaceError,
} from "./workspace";
import {
  listFileHistory,
  readFileHistoryVersion,
  recordFileSnapshot,
} from "./file-history";
import { runWorkspaceCommand } from "./terminal";
import {
  appendMirrorOutput,
  ensureAgentMirrorSession,
} from "./pty-manager";
import {
  validateAgentCommand,
  validateAgentCwd,
  validateDeletePath,
  validateWriteFile,
} from "./agent-workspace";
import { capturePagePreview } from "./page-preview";
import {
  toolText,
  toolTextWithImages,
  type AgentToolResult,
} from "./agent-tool-result";
import {
  analyzeCommandOutput,
  formatFileContentForAgent,
  stripAgentPastedLineNumbers,
} from "./build-diagnostics";
import { WorkspaceEditOverlay } from "./agent-runtime/edit-overlay";
import { grepWorkspace } from "./workspace-grep";
import type { AgentToolEvent } from "./agent-runtime/events";

/** Макс. строк в одном write_file — защита от обрезки ответа модели. */
`;

const footer = `
export type OpenAiMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export { runAgentToolLoop } from "./agent-openai-loop";
export type { AgentToolEvent } from "./agent-runtime/events";
`;

let typed = body
  .replace(
    /^const AGENT_TOOLS = /m,
    "export const AGENT_TOOLS: ChatCompletionTool[] = "
  )
  .replace(
    /^async function executeAgentTool\(input\) \{/m,
    `export async function executeAgentTool(input: {
  workspaceRoot: string;
  name: string;
  argsJson: string;
  signal?: AbortSignal;
  onEvent: (event: AgentToolEvent) => void;
  userIntent?: string;
}): Promise<AgentToolResult> {
  const { workspaceRoot, name, argsJson, signal, onEvent, userIntent = "" } = input;`
  )
  .replace(
    /function parseToolArgs\(raw\)/,
    "type ToolArgs = Record<string, unknown>;\n\nfunction parseToolArgs(raw: string): ToolArgs"
  )
  .replace(
    /function normalizeWriteContent\(args\)/,
    "function normalizeWriteContent(args: ToolArgs): string"
  )
  .replace(
    /function readStringArg\(args, \.\.\.keys\)/,
    "function readStringArg(args: ToolArgs, ...keys: string[]): string"
  )
  .replace(
    /function countOccurrences\(haystack, needle\)/,
    "function countOccurrences(haystack: string, needle: string): number"
  )
  .replace(
    /function emitToolFailed\(onEvent, name, detail, message\)/,
    "function emitToolFailed(\n  onEvent: (event: AgentToolEvent) => void,\n  name: string,\n  detail: string,\n  message: string\n): void"
  )
  .replace(
    /function toolDetailForError\(name, args\)/,
    "function toolDetailForError(name: string, args: ToolArgs): string"
  )
  .replace(
    /function clampWriteFileContent\(content\)/,
    "function clampWriteFileContent(content: string): {\n  content: string;\n  autoTruncated: boolean;\n  originalLines: number;\n}"
  )
  .replace(/const path2 = /g, "const path = ")
  .replace(/\bpath2\b/g, "path")
  .replace(/const url2 = /g, "const url = ")
  .replace(/\burl2\b/g, "url");

fs.writeFileSync("electron/main/agent-tools.ts", header + typed + footer, "utf8");
console.log("restored agent-tools.ts");
