import { executeAgentTool, type AgentInteractionMode, type AgentToolEvent, type OpenAiMessage, } from "./agent-tools";
import { getLastUserMessageText } from "./agent-reliability";
import { hasMatureProjectAt } from "./project-scaffold";
import type { AiRuntimeSettings } from "./ai";
import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
import { runAgentScheduler } from "./agent-runtime/scheduler";
import { createAnthropicSchedulerProvider } from "./agent-runtime/anthropic-provider";
export { splitAgentMessages } from "./agent-runtime/anthropic-provider";
export async function runAnthropicAgentToolLoop(input: {
    settings: AiRuntimeSettings;
    messages: OpenAiMessage[];
    workspaceRoot: string;
    interactionMode?: AgentInteractionMode;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
    onEvent: (event: AgentToolEvent) => void;
    onTranscript?: (turns: AgentTranscriptTurn[]) => void;
}): Promise<void> {
    const { settings, workspaceRoot, interactionMode = "agent", signal, onTextDelta, onEvent, onTranscript, } = input;
    const projectMature = await hasMatureProjectAt(workspaceRoot, ".");
    const provider = createAnthropicSchedulerProvider({
        settings,
        openAiMessages: input.messages,
        projectMature,
        interactionMode,
    });
    await runAgentScheduler({
        provider,
        maxAgentSteps: settings.maxAgentSteps,
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
            userIntent: getLastUserMessageText(provider.getMessages()),
            interactionMode,
        }),
    });
}
