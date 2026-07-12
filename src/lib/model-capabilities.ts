import type { UserAiProviderId } from "./providers";
export const CHARS_PER_TOKEN = 4;
export type ModelCapability = {
    contextWindowTokens: number;
    reservedOutputTokens: number;
    recommendedForAgent: boolean;
    label?: string;
};
const DEFAULT_CAPABILITY: ModelCapability = {
    contextWindowTokens: 32768,
    reservedOutputTokens: 4096,
    recommendedForAgent: true,
};
const CAPABILITY_BY_PATTERN: Array<{
    test: RegExp;
    capability: ModelCapability;
}> = [
    {
        test: /mistral-large/i,
        capability: {
            contextWindowTokens: 256000,
            reservedOutputTokens: 8192,
            recommendedForAgent: true,
            label: "Mistral Large 3 — флагман Mistral (675B MoE, multimodal)",
        },
    },
    {
        test: /devstral/i,
        capability: {
            contextWindowTokens: 128000,
            reservedOutputTokens: 8192,
            recommendedForAgent: true,
            label: "Devstral 2 — лучший выбор для agent mode (код)",
        },
    },
    {
        test: /codestral/i,
        capability: {
            contextWindowTokens: 32768,
            reservedOutputTokens: 4096,
            recommendedForAgent: true,
            label: "Codestral — быстрая модель для кода",
        },
    },
    {
        test: /pixtral/i,
        capability: {
            contextWindowTokens: 32768,
            reservedOutputTokens: 4096,
            recommendedForAgent: true,
            label: "Pixtral — vision + tools",
        },
    },
    {
        test: /mistral-medium/i,
        capability: {
            contextWindowTokens: 128000,
            reservedOutputTokens: 8192,
            recommendedForAgent: true,
            label: "Mistral Medium 3.5 — agentic + coding",
        },
    },
    {
        test: /gpt-4\.1|gpt-4o|o3|o4/i,
        capability: {
            contextWindowTokens: 128000,
            reservedOutputTokens: 8192,
            recommendedForAgent: true,
        },
    },
    {
        test: /claude-sonnet|claude-opus|claude-3/i,
        capability: {
            contextWindowTokens: 200000,
            reservedOutputTokens: 8192,
            recommendedForAgent: true,
        },
    },
    {
        test: /gemini-2\.5|gemini-2\.0/i,
        capability: {
            contextWindowTokens: 1000000,
            reservedOutputTokens: 8192,
            recommendedForAgent: true,
        },
    },
    {
        test: /deepseek/i,
        capability: {
            contextWindowTokens: 64000,
            reservedOutputTokens: 4096,
            recommendedForAgent: true,
        },
    },
    {
        test: /llama|mixtral|mistral-7|qwen|8b|7b/i,
        capability: {
            contextWindowTokens: 8192,
            reservedOutputTokens: 1024,
            recommendedForAgent: false,
            label: "Маленький контекст — agent mode может давать 400",
        },
    },
];
export function resolveModelCapability(provider: UserAiProviderId, model: string): ModelCapability {
    const id = model.trim().toLowerCase();
    if (!id)
        return DEFAULT_CAPABILITY;
    for (const entry of CAPABILITY_BY_PATTERN) {
        if (entry.test.test(id))
            return entry.capability;
    }
    if (provider === "ollama" ||
        provider === "lmstudio" ||
        provider === "openai_compatible") {
        return {
            contextWindowTokens: 8192,
            reservedOutputTokens: 1024,
            recommendedForAgent: false,
            label: "Локальная модель — увеличьте контекст в LM Studio/Ollama",
        };
    }
    if (provider === "mistral") {
        return {
            contextWindowTokens: 32768,
            reservedOutputTokens: 4096,
            recommendedForAgent: false,
            label: "Для agent mode укажите mistral-large-latest или devstral-2512",
        };
    }
    if (provider === "groq" || provider === "cerebras") {
        return {
            contextWindowTokens: 32768,
            reservedOutputTokens: 4096,
            recommendedForAgent: false,
            label: "Groq/Cerebras слабо с tool calling — лучше OpenAI/Claude/Mistral Codestral",
        };
    }
    return DEFAULT_CAPABILITY;
}
export function resolveInputCharBudget(provider: UserAiProviderId, model: string): number {
    const cap = resolveModelCapability(provider, model);
    const tokenBudget = Math.max(2048, cap.contextWindowTokens - cap.reservedOutputTokens);
    const fromTokens = tokenBudget * CHARS_PER_TOKEN;
    const usable = Math.max(5000, fromTokens - 6000);
    let capped = Math.min(usable, 120000);
    if (provider === "mistral" && /codestral/i.test(model)) {
        capped = Math.min(capped, 36000);
    }
    else if (provider === "mistral" && /mistral-large/i.test(model)) {
        capped = Math.min(capped, 96000);
    }
    else if (provider === "mistral") {
        capped = Math.min(capped, 28000);
    }
    return capped;
}
export function recommendedAgentModelHint(provider: UserAiProviderId): string {
    if (provider === "mistral")
        return "mistral-large-latest (или devstral-2512 для кода)";
    if (provider === "openai")
        return "gpt-4.1-mini";
    if (provider === "anthropic")
        return "claude-sonnet-4-0";
    if (provider === "gemini")
        return "gemini-2.0-flash";
    return "модель с большим контекстом и native tool calling";
}
