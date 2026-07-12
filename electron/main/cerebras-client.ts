import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type OpenAI from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import type { AiRuntimeSettings } from "./ai";
export function createCerebrasClient(settings: AiRuntimeSettings): Cerebras {
    const apiKey = settings.apiKey?.trim();
    if (!apiKey) {
        throw new Error("Укажите Cerebras API key в Settings.");
    }
    return new Cerebras({ apiKey });
}
function toCerebrasMessages(messages: ChatCompletionCreateParams["messages"]) {
    return messages.map((message) => {
        if (message.role === "tool") {
            return {
                role: "tool" as const,
                content: typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content ?? ""),
                tool_call_id: message.tool_call_id,
            };
        }
        if (message.role === "assistant") {
            const assistantMessage = message as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
            return {
                role: "assistant" as const,
                content: typeof assistantMessage.content === "string"
                    ? assistantMessage.content
                    : assistantMessage.content
                        ? JSON.stringify(assistantMessage.content)
                        : "",
                tool_calls: assistantMessage.tool_calls?.map((call) => {
                    if (call.type !== "function")
                        return null;
                    return {
                        id: call.id,
                        type: "function" as const,
                        function: {
                            name: call.function.name,
                            arguments: call.function.arguments,
                        },
                    };
                }).filter(Boolean),
            };
        }
        if (message.role === "system") {
            return {
                role: "system" as const,
                content: typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content ?? ""),
            };
        }
        return {
            role: "user" as const,
            content: typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content ?? ""),
        };
    });
}
function mapCerebrasCompletionToOpenAi(completion: {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index?: number;
        finish_reason?: string;
        message?: {
            content?: string | null;
            tool_calls?: Array<{
                id: string;
                type: "function";
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
        };
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}): OpenAI.Chat.Completions.ChatCompletion {
    const choice = completion.choices[0];
    const message = choice?.message;
    return {
        id: completion.id,
        object: "chat.completion",
        created: completion.created,
        model: completion.model,
        choices: [
            {
                index: choice?.index ?? 0,
                finish_reason: (choice?.finish_reason ?? "stop") as "stop",
                message: {
                    role: "assistant",
                    content: message?.content ?? null,
                    refusal: null,
                    tool_calls: message?.tool_calls?.map((call) => ({
                        id: call.id,
                        type: "function" as const,
                        function: {
                            name: call.function.name,
                            arguments: call.function.arguments,
                        },
                    })),
                },
                logprobs: null,
            },
        ],
        usage: completion.usage
            ? {
                prompt_tokens: completion.usage.prompt_tokens ?? 0,
                completion_tokens: completion.usage.completion_tokens ?? 0,
                total_tokens: completion.usage.total_tokens ?? 0,
            }
            : undefined,
    };
}
export async function streamCerebrasChatCompletion(input: {
    settings: AiRuntimeSettings;
    messages: ChatCompletionCreateParams["messages"];
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
}): Promise<void> {
    const client = createCerebrasClient(input.settings);
    const stream = await client.chat.completions.create({
        model: input.settings.model,
        messages: toCerebrasMessages(input.messages) as never,
        stream: true,
        max_completion_tokens: input.settings.maxOutputTokens ?? 1024,
        temperature: 0.2,
        top_p: 1,
    }, { signal: input.signal });
    for await (const chunk of stream) {
        if (!chunk || typeof chunk !== "object" || !("choices" in chunk))
            continue;
        const choices = chunk.choices as Array<{
            delta?: {
                content?: string | null;
            };
        }>;
        const delta = choices[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
            input.onTextDelta(delta);
        }
    }
}
export async function completeCerebrasChat(settings: AiRuntimeSettings, request: ChatCompletionCreateParams, options?: {
    signal?: AbortSignal;
    onGenerationChars?: (chars: number) => void;
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const client = createCerebrasClient(settings);
    const tools = request.tools
        ?.map((tool) => {
        if (tool.type !== "function")
            return null;
        return {
            type: "function" as const,
            function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters,
            },
        };
    })
        .filter(Boolean);
    const completion = await client.chat.completions.create({
        model: request.model,
        messages: toCerebrasMessages(request.messages) as never,
        stream: false,
        max_completion_tokens: request.max_tokens ?? settings.maxOutputTokens ?? 1024,
        temperature: request.temperature ?? 0.2,
        top_p: 1,
        ...(tools?.length
            ? {
                tools,
                tool_choice: "auto" as const,
            }
            : {}),
    } as never, { signal: options?.signal });
    const mapped = mapCerebrasCompletionToOpenAi(completion as Parameters<typeof mapCerebrasCompletionToOpenAi>[0]);
    const content = mapped.choices[0]?.message?.content;
    options?.onGenerationChars?.(typeof content === "string" ? content.length : 0);
    return mapped;
}
