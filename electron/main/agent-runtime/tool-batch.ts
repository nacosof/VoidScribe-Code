import type { AgentToolResult } from "../agent-tool-result";
import type { AgentTranscriptTurn } from "../../../src/lib/agent-transcript";
import { AgentTranscriptCollector } from "./transcript-collector";
export type AgentToolCallRequest = {
    id: string;
    name: string;
    arguments: string;
};
function toolDetailForBatch(name: string, argsJson: string): string {
    try {
        const args = JSON.parse(argsJson) as Record<string, unknown>;
        if (name === "list_directory") {
            return typeof args.path === "string" ? args.path : ".";
        }
        if (name === "grep") {
            const pattern = String(args.pattern ?? "").trim();
            const path = typeof args.path === "string" ? args.path : ".";
            return pattern ? `${pattern} @ ${path}` : "grep";
        }
        if (name === "read_file" ||
            name === "write_file" ||
            name === "search_replace" ||
            name === "restore_file" ||
            name === "delete_path") {
            return String(args.path ?? "").trim() || name;
        }
        if (name === "run_command") {
            return String(args.command ?? "").trim() || name;
        }
        if (name === "capture_page_preview") {
            return String(args.url ?? "").trim() || "preview";
        }
        return name;
    }
    catch {
        return name;
    }
}
export type AgentToolBatchResult = {
    call: AgentToolCallRequest;
    detail: string;
    result: AgentToolResult;
};
export async function executeAgentToolBatch(input: {
    calls: AgentToolCallRequest[];
    executeTool: (call: AgentToolCallRequest) => Promise<AgentToolResult>;
    transcriptCollector: AgentTranscriptCollector;
}): Promise<AgentToolBatchResult[]> {
    const { calls, executeTool, transcriptCollector } = input;
    const results: AgentToolBatchResult[] = [];
    for (const call of calls) {
        const detail = toolDetailForBatch(call.name, call.arguments);
        transcriptCollector.recordToolCall({
            id: call.id,
            name: call.name,
            arguments: call.arguments,
            detail,
        });
        const result = await executeTool(call);
        transcriptCollector.recordToolResult({
            toolCallId: call.id,
            name: call.name,
            detail,
            ok: result.ok !== false,
            text: result.text,
        });
        results.push({ call, detail, result });
    }
    return results;
}
export type { AgentTranscriptTurn };
