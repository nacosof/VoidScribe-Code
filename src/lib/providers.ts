export type UserAiProviderId = "openai" | "anthropic" | "openrouter" | "mistral" | "groq" | "cerebras" | "gemini" | "genapi" | "openai_compatible" | "ollama" | "lmstudio";
export type AiProvider = {
    id: UserAiProviderId;
    label: string;
    defaultModel: string;
    local?: boolean;
    needsBaseUrl?: boolean;
    needsApiKey?: boolean;
};
export const AI_PROVIDERS: AiProvider[] = [
    { id: "openai", label: "OpenAI", defaultModel: "gpt-4.1-mini", needsApiKey: true },
    { id: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-0", needsApiKey: true },
    { id: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-4.1-mini", needsApiKey: true },
    { id: "mistral", label: "Mistral", defaultModel: "mistral-large-latest", needsApiKey: true },
    { id: "groq", label: "Groq", defaultModel: "llama-3.3-70b-versatile", needsApiKey: true },
    { id: "cerebras", label: "Cerebras", defaultModel: "gpt-oss-120b", needsApiKey: true },
    { id: "gemini", label: "Gemini", defaultModel: "gemini-2.0-flash", needsApiKey: true },
    { id: "genapi", label: "GenAPI", defaultModel: "gpt-4o-mini", needsApiKey: true },
    { id: "openai_compatible", label: "OpenAI Compatible", defaultModel: "gpt-4o-mini", needsApiKey: true, needsBaseUrl: true },
    { id: "lmstudio", label: "LM Studio", defaultModel: "local-model", local: true, needsBaseUrl: true, needsApiKey: false },
    { id: "ollama", label: "Ollama", defaultModel: "llama3.1", local: true, needsBaseUrl: true, needsApiKey: false },
];
export function providerById(id: UserAiProviderId): AiProvider { return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]!; }
export function isLocalAgentProvider(id: UserAiProviderId): boolean { return id === "ollama" || id === "lmstudio" || id === "openai_compatible"; }
export function isLocalProvider(id: UserAiProviderId): boolean { return id === "ollama" || id === "lmstudio"; }
export function providerRequiresApiKey(id: UserAiProviderId): boolean {
    const provider = providerById(id);
    return provider.needsApiKey !== false && !provider.local;
}
export const LOCAL_PROVIDER_DEFAULTS = {
    ollama: "http://127.0.0.1:11434/v1",
    lmstudio: "http://127.0.0.1:1234/v1",
} as const;
export const LOCAL_API_KEY = "local";
export function resolveProviderBaseUrl(provider: UserAiProviderId, baseUrl?: string): string | undefined {
    const trimmed = baseUrl?.trim();
    if (trimmed)
        return trimmed;
    if (provider === "ollama")
        return LOCAL_PROVIDER_DEFAULTS.ollama;
    if (provider === "lmstudio")
        return LOCAL_PROVIDER_DEFAULTS.lmstudio;
    return undefined;
}
