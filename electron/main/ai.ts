import OpenAI from "openai";
import type { ChatCompletionCreateParams, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { isLocalProvider, providerRequiresApiKey, resolveProviderBaseUrl as resolveSharedProviderBaseUrl, type UserAiProviderId } from "../../src/lib/providers";
import { completeCerebrasChat, createCerebrasClient, streamCerebrasChatCompletion } from "./cerebras-client";
import { getSettings, type PersistedSettings } from "./store";
export type AiRuntimeSettings = PersistedSettings & {
    provider: UserAiProviderId;
    model: string;
    apiKey: string;
};
export const BASE_URL_BY_PROVIDER: Partial<Record<UserAiProviderId, string>> = {
    openrouter: "https://openrouter.ai/api/v1",
    mistral: "https://api.mistral.ai/v1",
    groq: "https://api.groq.com/openai/v1",
    cerebras: "https://api.cerebras.ai/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    genapi: "https://api.gen-api.ru/api/v1/networks/openai",
    lmstudio: "http://127.0.0.1:1234/v1",
    ollama: "http://127.0.0.1:11434/v1",
};
export function resolveRequestTimeoutMs(settings: {
    requestTimeoutMs?: number;
}): number {
    const value = settings.requestTimeoutMs;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 180000;
}
export function resolveAnthropicMaxTokens(value?: number): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 8192;
}
export function resolveAgentMaxOutputTokens(_provider?: UserAiProviderId, value?: number): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}
export function resolveProviderBaseUrl(settings: Pick<AiRuntimeSettings, "provider" | "baseUrl">): string | undefined {
    return resolveSharedProviderBaseUrl(settings.provider, settings.baseUrl)
        ?? BASE_URL_BY_PROVIDER[settings.provider];
}
export function settingsHaveUsableCredentials(settings: AiRuntimeSettings): boolean {
    if (!providerRequiresApiKey(settings.provider))
        return true;
    return Boolean(settings.apiKey?.trim());
}
function assertChatCompletionPayload(response: OpenAI.Chat.Completions.ChatCompletion, baseURL?: string): void {
    const asRecord = response as unknown as { error?: unknown; choices?: unknown[] };
    if (asRecord?.error != null && !asRecord.choices?.length) {
        throw new Error(`Локальный сервер отклонил запрос: ${String(asRecord.error)}. Проверь Base URL (нужен …/v1) и что модель загружена.`);
    }
    if (response?.choices?.length)
        return;
    const hasV1 = Boolean(baseURL && /\/v1$/i.test(baseURL.replace(/\/+$/, "")));
    const hint = !hasV1
        ? ` Base URL сейчас «${baseURL || "?"}» — для LM Studio/Ollama нужен суффикс /v1.`
        : " Base URL с /v1 ок; сервер всё равно вернул пустой ответ (модель/tools/сервер).";
    throw new Error(`Пустой ответ модели (нет choices).${hint}`);
}
export function createOpenAiClient(settings: AiRuntimeSettings = getSettings() as AiRuntimeSettings): OpenAI {
    const baseURL = resolveProviderBaseUrl(settings);
    const apiKey = settings.apiKey?.trim() || (isLocalProvider(settings.provider) ? "local" : "missing");
    return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}
export async function streamOpenAiAgentCompletion(client: OpenAI, request: ChatCompletionCreateParams, options?: {
    signal?: AbortSignal;
    onGenerationChars?: (chars: number) => void;
    settings?: AiRuntimeSettings;
    provider?: UserAiProviderId;
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const provider = options?.provider ?? options?.settings?.provider;
    if (provider === "cerebras" && options?.settings) {
        return completeCerebrasChat(options.settings, request, options);
    }
    const response = await client.chat.completions.create({ ...request, stream: false }, { signal: options?.signal });
    assertChatCompletionPayload(response, options?.settings ? resolveProviderBaseUrl(options.settings) : undefined);
    const content = response.choices?.[0]?.message?.content;
    options?.onGenerationChars?.(typeof content === "string" ? content.length : 0);
    return response;
}
export async function streamChatCompletion(input: {
    messages: ChatCompletionMessageParam[];
    settings?: AiRuntimeSettings;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
}): Promise<void> {
    const settings = input.settings ?? (getSettings() as AiRuntimeSettings);
    if (!settingsHaveUsableCredentials(settings)) {
        throw new Error("Укажите API key в Settings.");
    }
    if (settings.provider === "cerebras") {
        await streamCerebrasChatCompletion({
            settings,
            messages: input.messages,
            signal: input.signal,
            onTextDelta: input.onTextDelta,
        });
        return;
    }
    const client = createOpenAiClient(settings);
    const stream = await client.chat.completions.create({
        model: settings.model,
        messages: input.messages,
        stream: true,
        ...(settings.maxOutputTokens ? { max_tokens: settings.maxOutputTokens } : {}),
    }, { signal: input.signal });
    let gotChunk = false;
    for await (const chunk of stream) {
        gotChunk = true;
        const choice = chunk.choices?.[0];
        const delta = choice?.delta as {
            content?: string | null;
            reasoning_content?: string | null;
        } | undefined;
        const text = typeof delta?.content === "string" ? delta.content : "";
        if (text)
            input.onTextDelta(text);
    }
    if (!gotChunk) {
        assertChatCompletionPayload({ choices: [] } as OpenAI.Chat.Completions.ChatCompletion, resolveProviderBaseUrl(settings));
    }
}
export async function listProviderModels(settings: AiRuntimeSettings): Promise<string[]> {
    if (settings.provider === "cerebras") {
        const client = createCerebrasClient(settings);
        const models = await client.models.list();
        return models.data.map((item) => item.id).filter(Boolean);
    }
    if (isLocalProvider(settings.provider)) {
        const { probeOllama, probeLmStudio } = await import("./local-providers");
        const status = settings.provider === "ollama"
            ? await probeOllama(settings.baseUrl)
            : await probeLmStudio(settings.baseUrl);
        return status.models;
    }
    if (!settingsHaveUsableCredentials(settings)) {
        return [];
    }
    const client = createOpenAiClient(settings);
    const models = await client.models.list();
    return models.data.map((item) => item.id).filter(Boolean);
}
