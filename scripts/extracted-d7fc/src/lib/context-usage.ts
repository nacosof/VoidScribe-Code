import { resolvePresetSystemPrompt } from "./agent-roles";
import { buildUserMessageContent } from "./chat-context";
import type { UserAiProviderId } from "./providers";
import type { ChatContextRef, ChatMessage, SettingsPublic } from "@/types";

/** Грубая оценка токенов (без tiktoken на клиенте). */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 3.5));
}

export type ContextUsageSegmentId =
  | "system"
  | "rules"
  | "tools"
  | "workspace"
  | "conversation"
  | "draft"
  | "refs";

export type ContextUsageSegment = {
  id: ContextUsageSegmentId;
  tokens: number;
  approximate?: boolean;
};

export type ContextUsageReport = {
  segments: ContextUsageSegment[];
  variableTokens: number;
  fixedTokens: number;
  totalTokens: number;
  limitTokens: number;
  percent: number;
  fullPercent: number;
  limitIsConfigurable: boolean;
};

const FIXED_SEGMENT_IDS = new Set<ContextUsageSegmentId>([
  "system",
  "rules",
  "tools",
]);
const AGENT_RULES_OVERHEAD_TOKENS = 1_200;
const AGENT_TOOLS_OVERHEAD_TOKENS = 2_800;

const CONTEXT_LIMIT_BY_HINT: Array<{ test: RegExp; limit: number }> = [
  { test: /claude|anthropic/i, limit: 200_000 },
  { test: /gpt-4o|gpt-4\.1|o1|o3/i, limit: 128_000 },
  { test: /gemini-2\.5|gemini-2\.0/i, limit: 1_000_000 },
  { test: /deepseek/i, limit: 64_000 },
  { test: /qwen/i, limit: 32_768 },
  { test: /llama|mistral|mixtral/i, limit: 8_192 },
];

function resolveContextLimit(
  provider: UserAiProviderId,
  model: string
): { limit: number; configurable: boolean } {
  const hint = CONTEXT_LIMIT_BY_HINT.find((item) => item.test.test(model));
  if (hint) {
    return { limit: hint.limit, configurable: false };
  }

  if (
    provider === "ollama" ||
    provider === "lmstudio" ||
    provider === "openai_compatible"
  ) {
    return { limit: 8_192, configurable: true };
  }

  if (provider === "genapi" || provider === "openrouter") {
    return { limit: 128_000, configurable: false };
  }

  return { limit: 32_000, configurable: false };
}

function getActivePreset(settings: SettingsPublic, presetId: string) {
  return (
    settings.presets.find((item) => item.id === presetId) ??
    settings.presets.find((item) => item.id === settings.activePresetId) ??
    settings.presets[0]
  );
}

function conversationTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, message) => {
    if (message.role === "system") return sum;
    const content =
      message.role === "user" && message.contextRefs?.length
        ? buildUserMessageContent(message.content, message.contextRefs)
        : message.content;
    return sum + estimateTokens(content);
  }, 0);
}

export function computeChatContextUsage(input: {
  settings: SettingsPublic;
  presetId: string;
  messages: ChatMessage[];
  draft: string;
  contextRefs: ChatContextRef[];
  agentMode: boolean;
}): ContextUsageReport {
  const preset = getActivePreset(input.settings, input.presetId);
  const provider = preset?.provider ?? input.settings.provider;
  const model = preset?.model ?? input.settings.model;

  const systemPrompt = resolvePresetSystemPrompt({
    roleType: preset?.roleType ?? "developer",
    customRolePrompt: preset?.customRolePrompt,
    basePrompt: input.settings.systemPrompt,
  });

  const segments: ContextUsageSegment[] = [
    { id: "system", tokens: estimateTokens(systemPrompt) },
  ];

  if (input.agentMode) {
    segments.push(
      { id: "rules", tokens: AGENT_RULES_OVERHEAD_TOKENS, approximate: true },
      { id: "tools", tokens: AGENT_TOOLS_OVERHEAD_TOKENS, approximate: true }
    );
  }

  const refsText = buildUserMessageContent("", input.contextRefs);
  const refsTokens = estimateTokens(refsText);
  if (refsTokens > 0) {
    segments.push({ id: "refs", tokens: refsTokens });
  }

  segments.push({
    id: "conversation",
    tokens: conversationTokens(input.messages),
  });

  const draftTokens = estimateTokens(input.draft);
  if (draftTokens > 0) {
    segments.push({ id: "draft", tokens: draftTokens });
  }

  const totalTokens = segments.reduce((sum, item) => sum + item.tokens, 0);
  const fixedTokens = segments
    .filter((item) => FIXED_SEGMENT_IDS.has(item.id))
    .reduce((sum, item) => sum + item.tokens, 0);
  const variableTokens = totalTokens - fixedTokens;
  const { limit, configurable } = resolveContextLimit(provider, model);
  const percent =
    limit > 0 ? Math.min(100, (variableTokens / limit) * 100) : 0;
  const fullPercent =
    limit > 0 ? Math.min(100, (totalTokens / limit) * 100) : 0;

  return {
    segments: segments.filter((item) => item.tokens > 0),
    variableTokens,
    fixedTokens,
    totalTokens,
    limitTokens: limit,
    percent,
    fullPercent,
    limitIsConfigurable: configurable,
  };
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (tokens >= 10_000) {
    return `${Math.round(tokens / 1000)}K`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(tokens);
}

export const CONTEXT_SEGMENT_COLORS: Record<ContextUsageSegmentId, string> = {
  system: "#8b8fa3",
  rules: "#6bcb8e",
  tools: "#a78bfa",
  workspace: "#f87171",
  refs: "#fbbf24",
  conversation: "#5eead4",
  draft: "#60a5fa",
};
