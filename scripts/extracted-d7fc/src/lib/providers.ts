export type UserAiProviderId =
  | "openai"
  | "gemini"
  | "grok"
  | "claude"
  | "openrouter";

export type UserAiProviderKind = "openai" | "anthropic";

export type UserAiProviderConfig = {
  kind: UserAiProviderKind;
  label: string;
  baseURL?: string;
  defaultModel: string;
  keyPlaceholder: string;
};

export const USER_AI_PROVIDER_CONFIG: Record<
  UserAiProviderId,
  UserAiProviderConfig
> = {
  openai: {
    kind: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    keyPlaceholder: "sk-…",
  },
  gemini: {
    kind: "openai",
    label: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.0-flash",
    keyPlaceholder: "AIza…",
  },
  grok: {
    kind: "openai",
    label: "xAI Grok",
    baseURL: "https://api.x.ai/v1",
    defaultModel: "grok-2-latest",
    keyPlaceholder: "xai-…",
  },
  claude: {
    kind: "anthropic",
    label: "Anthropic Claude",
    defaultModel: "claude-haiku-4-5",
    keyPlaceholder: "sk-ant-…",
  },
  openrouter: {
    kind: "openai",
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    keyPlaceholder: "sk-or-…",
  },
};

export const USER_AI_PROVIDER_IDS = Object.keys(
  USER_AI_PROVIDER_CONFIG
) as UserAiProviderId[];

export function getUserAiProviderConfig(
  provider: UserAiProviderId
): UserAiProviderConfig {
  return USER_AI_PROVIDER_CONFIG[provider];
}

export function isUserAiProviderId(value: string): value is UserAiProviderId {
  return USER_AI_PROVIDER_IDS.includes(value as UserAiProviderId);
}
