import { AGENT_MAX_STALL_CONTINUES, AGENT_STALL_CONTINUE_NUDGE, AGENT_STEP_LIMIT_NOTE, AGENT_SUMMARY_AFTER_TOOLS_NUDGE, AGENT_TRUNCATION_USER_NOTE, batchNeedsUserSummary, buildTruncationNudge, createAssistantTextStreamer, looksLikeStalledAgentReply, } from "../agent-reliability";
import { resolveAgentStepLimit } from "../../../src/lib/agent-steps";
import type { AgentTranscriptTurn } from "../../../src/lib/agent-transcript";
import type { AgentToolEvent } from "./events";
import type { AgentSchedulerProvider } from "./provider-types";
import { AgentTranscriptCollector } from "./transcript-collector";
import { executeAgentToolBatch, type AgentToolBatchResult, type AgentToolCallRequest, } from "./tool-batch";
import { salvageWriteArguments } from "../agent-tool-parse";
const MUTATING_TOOLS = new Set(["write_file", "search_replace", "delete_path"]);
export async function runAgentScheduler(input: {
    provider: AgentSchedulerProvider;
    maxAgentSteps?: number;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
    onEvent: (event: AgentToolEvent) => void;
    onTranscript?: (turns: AgentTranscriptTurn[]) => void;
    executeTool: (call: AgentToolCallRequest) => Promise<{
        text: string;
        ok?: boolean;
        images?: import("../agent-tool-result").AgentToolImage[];
    }>;
    afterToolResult?: (item: AgentToolBatchResult) => void | Promise<void>;
}): Promise<void> {
    const { provider, maxAgentSteps, signal, onTextDelta, onEvent, onTranscript, executeTool, afterToolResult, } = input;
    const stepLimit = resolveAgentStepLimit(maxAgentSteps);
    const transcriptCollector = new AgentTranscriptCollector();
    const emitTranscript = () => onTranscript?.(transcriptCollector.snapshot());
    const streamAssistantText = createAssistantTextStreamer(onTextDelta);
    let lastFailedWriteMessage: string | null = null;
    let failedToolSteps = 0;
    let stallContinues = 0;
    let summaryNudgesSent = 0;
    for (let step = 0; stepLimit === null || step < stepLimit; step += 1) {
        if (signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }
        const modelStep = String(step + 1);
        onEvent({ type: "tool_start", name: "model", detail: modelStep });
        const modelStepResult = await provider.completeModelStep({
            modelStep,
            signal,
            onProgress: (chars) => {
                onEvent({ type: "model_progress", step: modelStep, chars });
            },
        });
        if (modelStepResult.toolCalls.length > 0) {
            if (modelStepResult.visibleText.trim()) {
                streamAssistantText.push(modelStepResult.visibleText);
            }
            else {
                streamAssistantText.reset();
            }
            transcriptCollector.beginToolTurn(modelStepResult.visibleText || undefined);
            provider.recordAssistantToolStep(modelStepResult);
            const preparedCalls = modelStepResult.toolCalls.slice(0, 1).map((call) => ({
                ...call,
                arguments: salvageWriteArguments(call.name, call.arguments, modelStepResult.visibleText),
            }));
            const batchResults = await executeAgentToolBatch({
                calls: preparedCalls,
                transcriptCollector,
                executeTool,
            });
            provider.recordToolBatchResults(batchResults);
            for (const item of batchResults) {
                await afterToolResult?.(item);
            }
            transcriptCollector.finishToolTurn();
            emitTranscript();
            onEvent({ type: "tool_done", name: "model", detail: modelStep });
            const writeSucceeded = batchResults.some((item) => (item.call.name === "write_file" || item.call.name === "search_replace") &&
                item.result.ok !== false);
            const deleteStaged = batchResults.some((item) => item.call.name === "delete_path" && item.result.ok !== false);
            const failedWrite = batchResults.find((item) => (item.call.name === "write_file" || item.call.name === "search_replace") &&
                item.result.ok === false);
            if (failedWrite) {
                lastFailedWriteMessage = failedWrite.result.text;
                failedToolSteps += 1;
            }
            else if (writeSucceeded || deleteStaged) {
                lastFailedWriteMessage = null;
                failedToolSteps = 0;
            }
            if (failedToolSteps >= 3) {
                streamAssistantText.push("Не удалось изменить файл: модель несколько раз отправила тот же код. " +
                    "Опиши конкретнее, что заменить (например: «замени FastAPI на Flask REST») — агент должен использовать search_replace или write_file с новым кодом.");
                transcriptCollector.recordFinalText("agent step limit after failed writes");
                emitTranscript();
                return;
            }
            const batchCalls = batchResults.map((item) => ({
                name: item.call.name,
                detail: item.detail,
            }));
            if (!modelStepResult.visibleText.trim() &&
                batchNeedsUserSummary(batchCalls) &&
                summaryNudgesSent < 1) {
                summaryNudgesSent += 1;
                provider.injectUserNudge?.(AGENT_SUMMARY_AFTER_TOOLS_NUDGE);
                continue;
            }
            continue;
        }
        onEvent({ type: "tool_done", name: "model", detail: modelStep });
        if (modelStepResult.truncatedOutput) {
            if (stallContinues < AGENT_MAX_STALL_CONTINUES) {
                stallContinues += 1;
                onTextDelta(`${AGENT_TRUNCATION_USER_NOTE}\n\n`);
                provider.injectUserNudge?.(buildTruncationNudge(modelStepResult.truncatedPath));
                continue;
            }
            onTextDelta(`${AGENT_TRUNCATION_USER_NOTE}\n\n`);
            return;
        }
        if (lastFailedWriteMessage && modelStepResult.visibleText.trim()) {
            streamAssistantText.reset();
            return;
        }
        if (modelStepResult.visibleText.trim()) {
            const refusal = /(?:не\s+могу|cannot|can't|unable\s+to\s+(?:perform|complete|execute))/i.test(modelStepResult.visibleText);
            if (refusal) {
                if (lastFailedWriteMessage) {
                    const detail = lastFailedWriteMessage.replace(/^Error:\s*/i, "").trim();
                    const isNoop = /не изменён|тот же текст|already contains|unchanged|identical/i.test(detail);
                    streamAssistantText.push(isNoop
                        ? "Файл не изменился — модель отправила тот же код. Опиши конкретнее замену (например: «замени FastAPI на REST API») — нужен search_replace или write_file с новым кодом."
                        : detail.startsWith("Пустой") || detail.startsWith("Файл")
                            ? detail
                            : `Не удалось записать файл: ${detail}`);
                    transcriptCollector.recordFinalText(detail);
                    emitTranscript();
                }
                else {
                    streamAssistantText.reset();
                }
                return;
            }
            if (looksLikeStalledAgentReply(modelStepResult.visibleText) &&
                stallContinues < AGENT_MAX_STALL_CONTINUES) {
                stallContinues += 1;
                if (provider.recordAssistantTextForNudge) {
                    provider.recordAssistantTextForNudge();
                }
                else {
                    provider.recordNudgeUserMessage?.(modelStepResult);
                }
                provider.injectUserNudge?.(AGENT_STALL_CONTINUE_NUDGE);
                continue;
            }
            streamAssistantText.push(modelStepResult.visibleText);
            transcriptCollector.recordFinalText(modelStepResult.visibleText);
            emitTranscript();
        }
        return;
    }
    if (stepLimit !== null) {
        streamAssistantText.push(AGENT_STEP_LIMIT_NOTE);
        transcriptCollector.recordFinalText("agent step limit");
        emitTranscript();
    }
}
