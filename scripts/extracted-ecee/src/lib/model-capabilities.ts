import type { UserAiProviderId } from "./providers";

/** Как в Void: ~4 символа на токен для грубой оценки контекста. */
export const CHARS_PER_TOKEN = 4;

export type ModelCapability = {
  contextWindowTokens: number;
  reservedOutputTokens: number;
  /** Рекомендуется для agent mode (tools). */
  recommendedForAgent: boolean;
  label?: string;
};

const DEFAULT_CAPABILITY: ModelCapability = {
  contextWindowTokens: 32_768,
  reservedOutputTokens: 4_096,
  recommendedForAgent: true,
};

const CAPABILITY_BY_PATTERN: Array<{
  test: RegExp;
  capability: ModelCapability;
}> = [
  {
    test: /codestral/i,
    capability: {
      contextWindowTokens: 32_768,
      reservedOutputTokens: 4_096,
      recommendedForAgent: true,
      label: "Codestral — лучший выбор для agent mode у Mistral",
    },
  },
  {
    test: /pixtral/i,
    capability: {
      contextWindowTokens: 32_768,
      reservedOutputTokens: 4_096,
      recommendedForAgent: true,
      label: "Pixtral — vision + tools",
    },
  },
  {
    test: /mistral-large|mistral-medium/i,
    capability: {
      contextWindowTokens: 128_000,
      reservedOutputTokens: 8_192,
      recommendedForAgent: true,
    },
  },
  {
    test: /gpt-4\.1|gpt-4o|o3|o4/i,
    capability: {
      contextWindowTokens: 128_000,
      reservedOutputTokens: 8_192,
      recommendedForAgent: true,
    },
  },
  {
    test: /claude-sonnet|claude-opus|claude-3/i,
    capability: {
      contextWindowTokens: 200_000,
      reservedOutputTokens: 8_192,
      recommendedForAgent: true,
    },
  },
  {
    test: /gemini-2\.5|gemini-2\.0/i,
    capability: {
      contextWindowTokens: 1_000_000,
      reservedOutputTokens: 8_192,
      recommendedForAgent: true,
    },
  },
  {
    test: /deepseek/i,
    capability: {
      contextWindowTokens: 64_000,
      reservedOutputTokens: 4_096,
      recommendedForAgent: true,
    },
  },
  {
    test: /llama|mixtral|mistral-7|qwen|8b|7b/i,
    capability: {
      contextWindowTokens: 8_192,
      reservedOutputTokens: 1_024,
      recommendedForAgent: false,
      label: "Маленький контекст — agent mode может давать 400",
    },
  },
];

export function resolveModelCapability(
  provider: UserAiProviderId,
  model: string
): ModelCapability {
  const id = model.trim().toLowerCase();
  if (!id) return DEFAULT_CAPABILITY;

  for (const entry of CAPABILITY_BY_PATTERN) {
    if (entry.test.test(id)) return entry.capability;
  }

  if (
    provider === "ollama" ||
    provider === "lmstudio" ||
    provider === "openai_compatible"
  ) {
    return {
      contextWindowTokens: 8_192,
      reservedOutputTokens: 1_024,
      recommendedForAgent: false,
      label: "Локальная модель — увеличьте контекст в LM Studio/Ollama",
    };
  }

  if (provider === "mistral") {
    return {
      contextWindowTokens: 32_768,
      reservedOutputTokens: 4_096,
      recommendedForAgent: false,
      label: "Для agent mode укажите codestral-latest",
    };
  }

  if (provider === "groq" || provider === "cerebras") {
    return {
      contextWindowTokens: 32_768,
      reservedOutputTokens: 4_096,
      recommendedForAgent: false,
      label: "Groq/Cerebras слабо с tool calling — лучше OpenAI/Claude/Mistral Codestral",
    };
  }

  return DEFAULT_CAPABILITY;
}

/** Бюджет символов для input (история + system + tools), по образцу Void. */
export function resolveInputCharBudget(
  provider: UserAiProviderId,
  model: string
): number {
  const cap = resolveModelCapability(provider, model);
  const tokenBudget = Math.max(
    2_048,
    cap.contextWindowTokens - cap.reservedOutputTokens
  );
  const fromTokens = tokenBudget * CHARS_PER_TOKEN;
  // Tools + overhead ~6k chars
  const usable = Math.max(5_000, fromTokens - 6_000);
  return Math.min(usable, 120_000);
}

export function recommendedAgentModelHint(provider: UserAiProviderId): string {
  if (provider === "mistral") return "codestral-latest";
  if (provider === "openai") return "gpt-4.1-mini";
  if (provider === "anthropic") return "claude-sonnet-4-0";
  if (provider === "gemini") return "gemini-2.0-flash";
  return "модель с большим контекстом и native tool calling";
}
