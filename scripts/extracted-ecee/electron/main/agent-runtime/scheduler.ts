/**
 * Void-style agent loop (voideditor/void chatThreadService._runChatAgent):
 * call model → if tool_calls, execute → append results → repeat; else stream text and stop.
 * No step nudges, no repeat guards, no duplicate guards.
 */
import {
  AGENT_TRUNCATION_USER_NOTE,
  createAssistantTextStreamer,
} from "../agent-reliability";
import { resolveAgentStepLimit } from "../../../src/lib/agent-steps";
import type { AgentTranscriptTurn } from "../../../src/lib/agent-transcript";
import type { AgentToolEvent } from "./events";
import type { AgentSchedulerProvider } from "./provider-types";
import { AgentTranscriptCollector } from "./transcript-collector";
import {
  executeAgentToolBatch,
  type AgentToolBatchResult,
  type AgentToolCallRequest,
} from "./tool-batch";

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
    images?: unknown[];
  }>;
  afterToolResult?: (item: AgentToolBatchResult) => void | Promise<void>;
}): Promise<void> {
  const {
    provider,
    maxAgentSteps,
    signal,
    onTextDelta,
    onEvent,
    onTranscript,
    executeTool,
    afterToolResult,
  } = input;

  const stepLimit = resolveAgentStepLimit(maxAgentSteps);
  const transcriptCollector = new AgentTranscriptCollector();
  const emitTranscript = () => onTranscript?.(transcriptCollector.snapshot());
  const streamAssistantText = createAssistantTextStreamer(onTextDelta);

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
      streamAssistantText.reset();
      if (modelStepResult.visibleText.trim()) {
        streamAssistantText.push(modelStepResult.visibleText);
      }

      transcriptCollector.beginToolTurn(modelStepResult.visibleText || undefined);
      provider.recordAssistantToolStep(modelStepResult);

      const batchResults = await executeAgentToolBatch({
        calls: modelStepResult.toolCalls,
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
      continue;
    }

    onEvent({ type: "tool_done", name: "model", detail: modelStep });

    if (modelStepResult.visibleText.trim()) {
      streamAssistantText.push(modelStepResult.visibleText);
      transcriptCollector.recordFinalText(modelStepResult.visibleText);
      emitTranscript();
    } else if (modelStepResult.truncatedOutput) {
      onTextDelta(`${AGENT_TRUNCATION_USER_NOTE}\n\n`);
    }

    return;
  }
}
