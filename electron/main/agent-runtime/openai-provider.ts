import type OpenAI from "openai";
import { AGENT_CHAT_RETRIES, AGENT_CHAT_RETRY_DELAY_MS, isRateLimitError, isToolCallGenerationError, rateLimitBackoffMs, sleep, } from "../agent-reliability";
import { getAgentToolsForMode, type AgentInteractionMode, type OpenAiMessage, } from "../agent-tools";
import { resolveAgentMaxOutputTokens, streamOpenAiAgentCompletion, type AiRuntimeSettings, } from "../ai";
import { getSettings } from "../store";
import { resolveAssistantToolCalls, peekTruncatedWriteFilePath } from "../agent-tool-parse";
import { sortToolsForExecution } from "../agent-tool-order";
import { compactInflightAgentMessages } from "../agent-transcript-compact";
import { compactMessagesForApi, isLikelyContextOverflow400, } from "../agent-context-budget";
import { isLocalAgentProvider, type UserAiProviderId, } from "../../../src/lib/providers";
import type { AgentToolEvent } from "./events";
import type { AgentSchedulerProvider, SchedulerModelStep, } from "./provider-types";
import type { AgentToolCallRequest } from "./tool-batch";
export type OpenAiSchedulerProviderOptions = {
    client: OpenAI;
    model: string;
    provider?: UserAiProviderId;
    messages: OpenAiMessage[];
    maxOutputTokens?: number;
    interactionMode?: AgentInteractionMode;
    projectMature?: boolean;
    onEvent: (event: AgentToolEvent) => void;
};
export function createOpenAiSchedulerProvider(options: OpenAiSchedulerProviderOptions): AgentSchedulerProvider & {
    appendUserContent(content: OpenAiMessage["content"]): void;
} {
    const { client, model, provider = "openai", maxOutputTokens, interactionMode = "agent", onEvent, } = options;
    const messages = options.messages;
    const agentTools = getAgentToolsForMode(interactionMode);
    const maxTokens = resolveAgentMaxOutputTokens(provider, maxOutputTokens);
    const localProvider = isLocalAgentProvider(provider);
    let useNativeTools = agentTools.length > 0;
    let temperature = 0.3;
    const usesInlineToolResults = () => localProvider && !useNativeTools;
    return {
        getMessages() {
            return messages;
        },
        async completeModelStep(input): Promise<SchedulerModelStep> {
            compactInflightAgentMessages(messages, { provider });
            compactMessagesForApi(messages, provider, { model, aggressive: true });
            let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
            let contextTrimAttempts = 0;
            for (let attempt = 0; attempt < AGENT_CHAT_RETRIES + 1; attempt += 1) {
                try {
                    const request: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
                        model,
                        messages,
                        temperature,
                        ...(maxTokens ? { max_tokens: maxTokens } : {}),
                    };
                    if (useNativeTools) {
                        request.tools = agentTools;
                        request.tool_choice = "auto";
                    }
                    response = await streamOpenAiAgentCompletion(client, request, {
                        signal: input.signal,
                        onGenerationChars: input.onProgress,
                        provider,
                        settings: provider === "cerebras"
                            ? (getSettings() as AiRuntimeSettings)
                            : undefined,
                    });
                    break;
                }
                catch (err) {
                    if (input.signal?.aborted) {
                        throw new DOMException("Aborted", "AbortError");
                    }
                    if (contextTrimAttempts < 4 &&
                        isLikelyContextOverflow400(err) &&
                        compactMessagesForApi(messages, provider, {
                            model,
                            aggressive: true,
                        })) {
                        contextTrimAttempts += 1;
                        continue;
                    }
                    if (localProvider && useNativeTools && attempt < 2) {
                        useNativeTools = false;
                        continue;
                    }
                    if (isRateLimitError(err) && attempt < 2) {
                        await sleep(rateLimitBackoffMs(attempt));
                        continue;
                    }
                    if (isToolCallGenerationError(err) && attempt < 2) {
                        temperature = Math.max(0.1, temperature - 0.15);
                        continue;
                    }
                    if (attempt < AGENT_CHAT_RETRIES && !isLikelyContextOverflow400(err)) {
                        await sleep(AGENT_CHAT_RETRY_DELAY_MS);
                        continue;
                    }
                    throw err;
                }
            }
            if (!response) {
                throw new Error("Пустой ответ модели.");
            }
            const choice = response.choices[0];
            const message = choice?.message;
            if (!message) {
                throw new Error("Пустой ответ модели.");
            }
            const resolved = resolveAssistantToolCalls({
                content: message.content,
                reasoning_content: (message as {
                    reasoning_content?: string | null;
                })
                    .reasoning_content,
                tool_calls: message.tool_calls,
                function_call: (message as {
                    function_call?: {
                        name?: string;
                        arguments?: string;
                    };
                }).function_call,
            });
            const truncatedOutput = choice?.finish_reason === "length" && resolved.truncatedInlineTool;
            const toolCalls: AgentToolCallRequest[] = sortToolsForExecution(resolved.toolCalls.filter((item) => item.type === "function"))
                .filter((item) => item.type === "function")
                .map((call) => ({
                id: call.id,
                name: call.function.name,
                arguments: call.function.arguments,
            }));
            return {
                visibleText: resolved.visibleText,
                toolCalls,
                finishReason: choice?.finish_reason ?? null,
                truncatedOutput,
                truncatedPath: truncatedOutput
                    ? peekTruncatedWriteFilePath([message.content, (message as {
                            reasoning_content?: string;
                        }).reasoning_content]
                        .filter((p) => typeof p === "string")
                        .join("\n"))
                    : null,
            };
        },
        recordAssistantToolStep(step) {
            if (usesInlineToolResults()) {
                messages.push({
                    role: "assistant",
                    content: step.visibleText.trim() || "(tool call)",
                });
                return;
            }
            messages.push({
                role: "assistant",
                content: step.visibleText || null,
                tool_calls: step.toolCalls.map((call) => ({
                    id: call.id,
                    type: "function" as const,
                    function: {
                        name: call.name,
                        arguments: call.arguments,
                    },
                })),
            });
        },
        recordToolBatchResults(results) {
            if (usesInlineToolResults()) {
                const body = results
                    .map(({ call, result }) => `<tool_result name="${call.name}">\n${result.text}\n</tool_result>`)
                    .join("\n\n");
                messages.push({
                    role: "user",
                    content: `Tool results:\n\n${body}`,
                });
                return;
            }
            for (const { call, result } of results) {
                messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: result.text,
                });
            }
        },
        appendUserContent(content: OpenAiMessage["content"]) {
            messages.push({ role: "user", content: (content ?? "") as string });
        },
        injectUserNudge(content: unknown) {
            messages.push({
                role: "user",
                content: typeof content === "string" ? content : String(content ?? ""),
            });
        },
        recordNudgeUserMessage(step: SchedulerModelStep) {
            const text = step.visibleText.trim();
            if (!text)
                return;
            messages.push({ role: "assistant", content: text });
        },
    };
}
