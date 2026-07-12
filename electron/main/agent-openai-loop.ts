import type OpenAI from "openai";
import { executeAgentTool, type AgentInteractionMode, type AgentToolEvent, type OpenAiMessage } from "./agent-tools";
import { toOpenAiVisionFollowUp } from "./agent-tool-result";
import { getLastUserMessageText } from "./agent-reliability";
import { hasMatureProjectAt } from "./project-scaffold";
import { modelSupportsVision } from "../../src/lib/model-vision";
import type { UserAiProviderId } from "../../src/lib/providers";
import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
import { runAgentScheduler } from "./agent-runtime/scheduler";
import { createOpenAiSchedulerProvider } from "./agent-runtime/openai-provider";
export async function runAgentToolLoop(input: {
    client: OpenAI;
    model: string;
    provider?: UserAiProviderId;
    messages: OpenAiMessage[];
    workspaceRoot: string;
    maxOutputTokens?: number;
    maxAgentSteps?: number;
    interactionMode?: AgentInteractionMode;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
    onEvent: (event: AgentToolEvent) => void;
    onTranscript?: (turns: AgentTranscriptTurn[]) => void;
}): Promise<void> {
    const { client, model, provider = "openai", workspaceRoot, maxOutputTokens, maxAgentSteps, interactionMode = "agent", signal, onTextDelta, onEvent, onTranscript, } = input;
    const projectMature = await hasMatureProjectAt(workspaceRoot, ".");
    const supportsVision = modelSupportsVision(provider, model);
    const schedulerProvider = createOpenAiSchedulerProvider({
        client,
        model,
        provider,
        messages: [...input.messages],
        maxOutputTokens,
        projectMature,
        interactionMode,
        onEvent,
    });
    await runAgentScheduler({
        provider: schedulerProvider,
        maxAgentSteps,
        signal,
        onTextDelta,
        onEvent,
        onTranscript,
        executeTool: async (call) => executeAgentTool({
            workspaceRoot,
            name: call.name,
            argsJson: call.arguments,
            signal,
            onEvent,
            userIntent: getLastUserMessageText(schedulerProvider.getMessages() as OpenAiMessage[]),
            interactionMode,
        }),
        afterToolResult: async ({ result }) => {
            const visionParts = supportsVision ? toOpenAiVisionFollowUp(result) : null;
            if (visionParts) {
                schedulerProvider.appendUserContent(visionParts);
            }
            else if (result.images?.length) {
                schedulerProvider.appendUserContent("[Скриншот страницы не передан в модель — нет vision. Продолжай по тексту capture_page_preview или смени модель на vision.]");
            }
        },
    });
}
