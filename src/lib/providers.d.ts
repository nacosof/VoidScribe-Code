export type UserAiProviderId = "openai" | "anthropic" | "openrouter" | "mistral" | "groq" | "cerebras" | "gemini" | "genapi" | "openai_compatible" | "ollama" | "lmstudio";
export type AiProvider = {
    id: UserAiProviderId;
    label: string;
    defaultModel: string;
    local?: boolean;
    needsBaseUrl?: boolean;
    needsApiKey?: boolean;
};
export declare const AI_PROVIDERS: AiProvider[];
export declare function providerById(id: UserAiProviderId): AiProvider;
export declare function isLocalAgentProvider(id: UserAiProviderId): boolean;
