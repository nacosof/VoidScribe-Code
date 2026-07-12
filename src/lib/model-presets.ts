import type { UserAiProviderId } from "./providers";
export const MODEL_PRESETS: Record<UserAiProviderId, string[]> = {
    openai: ["gpt-4.1-mini", "gpt-4o", "gpt-4.1"],
    anthropic: ["claude-sonnet-4-0", "claude-3-5-sonnet-latest"],
    openrouter: ["openai/gpt-4.1-mini", "anthropic/claude-sonnet-4"],
    mistral: [
        "mistral-large-latest",
        "mistral-medium-latest",
        "mistral-small-latest",
        "devstral-2512",
        "codestral-latest",
        "ministral-8b-latest",
    ],
    groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
    cerebras: ["gpt-oss-120b", "llama3.1-70b", "llama-3.3-70b"],
    gemini: ["gemini-2.0-flash", "gemini-2.5-flash-preview"],
    genapi: ["gpt-4o-mini", "gpt-4o"],
    openai_compatible: ["gpt-4o-mini"],
    ollama: ["llama3.1", "qwen2.5-coder", "deepseek-r1"],
    lmstudio: ["local-model"],
};
