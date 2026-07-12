import type { AgentEditorContext, ChatMessage } from "../../src/types";
import type { ChatInteractionMode } from "../../src/lib/chat-modes";
import { isLocalAgentProvider, isLocalProvider } from "../../src/lib/providers";
import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
import { refreshMcpTools } from "./mcp-service";
import { getSettings, type PersistedSettings } from "./store";
import { createOpenAiClient, settingsHaveUsableCredentials, streamChatCompletion, type AiRuntimeSettings } from "./ai";
import { runAgentToolLoop } from "./agent-openai-loop";
import { runAnthropicAgentToolLoop } from "./agent-anthropic";
import { chatHistoryToAgentOpenAiMessages } from "./agent-transcript-replay";
import { chatHistoryToOpenAiMessages } from "./chat-vision";
import { buildAgentSystemPrompt } from "./agent-system-prompt";
import { assertWorkspaceRoot, WorkspaceError } from "./workspace";
import { resetPathEditGuard } from "./agent-path-edit-guard";
import { WorkspaceEditOverlay } from "./agent-runtime/edit-overlay";
import type { AgentToolEvent } from "./agent-tools";
function assertAgentSettings(settings: PersistedSettings): void {
    const runtime = settings as AiRuntimeSettings;
    if (!settingsHaveUsableCredentials(runtime)) {
        throw new Error("Добавьте агента в Settings: API-ключ или локальный провайдер (Ollama / LM Studio).");
    }
    if (!isLocalProvider(settings.provider) && !settings.apiKey?.trim()) {
        throw new Error("Укажите API key в Settings.");
    }
    if (!settings.model?.trim()) {
        throw new Error("Укажите ID модели в Settings.");
    }
}
export async function flushRemainingAgentEdits(workspaceRoot: string): Promise<string[]> {
    const root = workspaceRoot.trim();
    if (!root)
        return [];
    return WorkspaceEditOverlay.forRoot(root).flushAll(root);
}
export async function streamAgentChat(input: {
    messages: ChatMessage[];
    workspaceRoot: string;
    mode?: ChatInteractionMode;
    editorContext?: AgentEditorContext;
    settings?: PersistedSettings;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
    onEvent: (event: AgentToolEvent) => void;
    onTranscript?: (turns: AgentTranscriptTurn[]) => void;
}): Promise<void> {
    const settings = input.settings ?? getSettings();
    const mode = input.mode ?? "agent";
    assertAgentSettings(settings);
    if (mode === "agent") {
        await refreshMcpTools(true);
    }
    if (mode === "normal") {
        await streamChatCompletion({
            messages: chatHistoryToOpenAiMessages(input.messages, {
                provider: settings.provider,
                model: settings.model,
            }),
            settings: settings as AiRuntimeSettings,
            signal: input.signal,
            onTextDelta: input.onTextDelta,
        });
        return;
    }
    const workspaceRoot = input.workspaceRoot.trim();
    if (!workspaceRoot) {
        throw new WorkspaceError("Откройте папку проекта для режима Агент.");
    }
    assertWorkspaceRoot(workspaceRoot);
    resetPathEditGuard(workspaceRoot);
    const messages = chatHistoryToAgentOpenAiMessages(input.messages, {
        provider: settings.provider,
        model: settings.model,
    });
    const useInlineToolFormat = isLocalAgentProvider(settings.provider);
    messages.unshift({
        role: "system",
        content: await buildAgentSystemPrompt({
            mode,
            workspaceRoot,
            useInlineToolFormat,
            editorContext: input.editorContext,
        }),
    });
    try {
        if (settings.provider === "anthropic") {
            await runAnthropicAgentToolLoop({
                settings,
                messages,
                workspaceRoot,
                interactionMode: mode,
                signal: input.signal,
                onTextDelta: input.onTextDelta,
                onEvent: input.onEvent,
                onTranscript: input.onTranscript,
            });
            return;
        }
        await runAgentToolLoop({
            client: createOpenAiClient(settings as AiRuntimeSettings),
            model: settings.model,
            provider: settings.provider,
            messages,
            workspaceRoot,
            maxOutputTokens: settings.maxOutputTokens,
            maxAgentSteps: settings.maxAgentSteps,
            interactionMode: mode,
            signal: input.signal,
            onTextDelta: input.onTextDelta,
            onEvent: input.onEvent,
            onTranscript: input.onTranscript,
        });
    }
    finally {
        await flushRemainingAgentEdits(workspaceRoot);
    }
}
