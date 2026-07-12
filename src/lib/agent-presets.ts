import { isLocalProvider, providerById, resolveProviderBaseUrl, LOCAL_API_KEY, type UserAiProviderId } from "./providers";
import { normalizeChatMode, type ChatInteractionMode } from "./chat-modes";
export type AgentPreset = {
    id: string;
    name: string;
    provider: UserAiProviderId;
    model: string;
    apiKey: string;
    baseUrl?: string;
    maxOutputTokens?: number;
    maxAgentSteps?: number;
};
export type AgentSettingsState = {
    activePresetId: string;
    presets: AgentPreset[];
    language?: "en" | "ru";
    theme?: string;
    windowLayout?: "editor" | "agent";
    defaultChatMode?: ChatInteractionMode;
};
export function createPresetId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
export function getPresetLabel(preset: {
    name?: string;
    model: string;
}): string {
    const name = preset.name?.trim();
    return name || preset.model;
}
export function maskApiKeyHint(apiKey: string): string {
    const trimmed = apiKey.trim();
    if (!trimmed)
        return "";
    if (trimmed.length <= 4)
        return trimmed;
    return `…${trimmed.slice(-4)}`;
}
export function isPresetReady(preset: AgentPreset): boolean {
    if (isLocalProvider(preset.provider)) {
        return Boolean(preset.model.trim());
    }
    return Boolean(preset.apiKey.trim());
}
export function getReadyPresets(settings: AgentSettingsState): AgentPreset[] {
    return settings.presets.filter(isPresetReady);
}
export function getActivePreset(settings: AgentSettingsState): AgentPreset | null {
    const ready = getReadyPresets(settings);
    if (!ready.length)
        return null;
    return (ready.find((item) => item.id === settings.activePresetId) ?? ready[0] ?? null);
}
function mapRawPreset(item: Record<string, unknown>): AgentPreset | null {
    const apiKey = typeof item.apiKey === "string" ? item.apiKey : "";
    const model = typeof item.model === "string" ? item.model.trim() : "";
    const provider = typeof item.provider === "string" ? (item.provider as UserAiProviderId) : "openai";
    const id = typeof item.id === "string" ? item.id : createPresetId();
    const name = typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : model || providerById(provider).defaultModel;
    const isLocal = isLocalProvider(provider);
    const resolvedModel = model || providerById(provider).defaultModel;
    if (!isLocal && !apiKey.trim())
        return null;
    if (isLocal && !resolvedModel.trim())
        return null;
    return {
        id,
        name,
        provider,
        model: resolvedModel,
        apiKey: isLocal ? apiKey.trim() || LOCAL_API_KEY : apiKey.trim(),
        baseUrl: resolveProviderBaseUrl(provider, typeof item.baseUrl === "string" ? item.baseUrl : undefined),
        maxOutputTokens: typeof item.maxOutputTokens === "number" ? item.maxOutputTokens : undefined,
        maxAgentSteps: typeof item.maxAgentSteps === "number" ? item.maxAgentSteps : undefined,
    };
}
export function normalizeAgentSettings(raw: Partial<AgentSettingsState> & Record<string, unknown>): AgentSettingsState {
    const language = raw.language === "ru" ? "ru" : "en";
    const theme = typeof raw.theme === "string" ? raw.theme : "voidscribe";
    const windowLayout = raw.windowLayout === "agent" ? "agent" : "editor";
    const defaultChatMode = normalizeChatMode(raw.defaultChatMode as ChatInteractionMode | "gather" | undefined);
    if (Array.isArray(raw.presets) && raw.presets.length > 0) {
        const presets = raw.presets
            .map((item) => mapRawPreset(item as Record<string, unknown>))
            .filter((item): item is AgentPreset => Boolean(item));
        const activePresetId = typeof raw.activePresetId === "string" &&
            presets.some((item) => item.id === raw.activePresetId)
            ? raw.activePresetId
            : (presets[0]?.id ?? "");
        return { activePresetId, presets, language, theme, windowLayout, defaultChatMode };
    }
    const apiKey = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
    if (!apiKey) {
        return { activePresetId: "", presets: [], language, theme, windowLayout, defaultChatMode };
    }
    const provider = typeof raw.provider === "string" ? (raw.provider as UserAiProviderId) : "openai";
    const model = typeof raw.model === "string" && raw.model.trim()
        ? raw.model.trim()
        : providerById(provider).defaultModel;
    const id = createPresetId();
    return {
        activePresetId: id,
        presets: [
            {
                id,
                name: typeof raw.agentName === "string" && raw.agentName.trim()
                    ? raw.agentName.trim()
                    : model,
                provider,
                model,
                apiKey,
                baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : undefined,
                maxOutputTokens: typeof raw.maxOutputTokens === "number" ? raw.maxOutputTokens : undefined,
                maxAgentSteps: typeof raw.maxAgentSteps === "number" ? raw.maxAgentSteps : undefined,
            },
        ],
        language,
        theme,
        windowLayout,
        defaultChatMode,
    };
}
export function selectPreset(settings: AgentSettingsState, presetId: string): AgentSettingsState {
    if (!settings.presets.some((item) => item.id === presetId)) {
        return settings;
    }
    return { ...settings, activePresetId: presetId };
}
export function deletePreset(settings: AgentSettingsState, presetId: string): AgentSettingsState {
    const presets = settings.presets.filter((item) => item.id !== presetId);
    const activePresetId = settings.activePresetId === presetId
        ? (presets[0]?.id ?? "")
        : settings.activePresetId;
    return { ...settings, presets, activePresetId };
}
export function addPreset(settings: AgentSettingsState, input: {
    name: string;
    provider: UserAiProviderId;
    model: string;
    apiKey: string;
    baseUrl?: string;
}): AgentSettingsState {
    const apiKey = input.apiKey.trim();
    const isLocal = isLocalProvider(input.provider);
    if (!isLocal && !apiKey)
        return settings;
    const model = input.model.trim() || providerById(input.provider).defaultModel;
    if (isLocal && !input.model.trim())
        return settings;
    const preset: AgentPreset = {
        id: createPresetId(),
        name: input.name.trim() || model,
        provider: input.provider,
        model,
        apiKey: isLocal ? LOCAL_API_KEY : apiKey,
        baseUrl: resolveProviderBaseUrl(input.provider, input.baseUrl),
    };
    return {
        ...settings,
        presets: [...settings.presets, preset],
        activePresetId: preset.id,
    };
}
export function updatePreset(settings: AgentSettingsState, input: {
    presetId: string;
    name?: string;
    maxOutputTokens?: number;
    maxAgentSteps?: number;
}): AgentSettingsState {
    const presets = settings.presets.map((item) => {
        if (item.id !== input.presetId)
            return item;
        return {
            ...item,
            ...(input.name !== undefined ? { name: input.name.trim() || item.model } : {}),
            ...(input.maxOutputTokens !== undefined
                ? { maxOutputTokens: input.maxOutputTokens }
                : {}),
            ...(input.maxAgentSteps !== undefined ? { maxAgentSteps: input.maxAgentSteps } : {}),
        };
    });
    return { ...settings, presets };
}
export function toRuntimePreset(settings: AgentSettingsState): AgentPreset | null {
    return getActivePreset(settings);
}
