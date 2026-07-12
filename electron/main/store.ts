import Store from "electron-store";
import { addPreset, deletePreset, getActivePreset, normalizeAgentSettings, selectPreset, updatePreset, type AgentPreset, type AgentSettingsState, } from "../../src/lib/agent-presets";
import type { ChatSession } from "../../src/types";
import type { ChatInteractionMode } from "../../src/lib/chat-modes";
import type { UserAiProviderId } from "../../src/lib/providers";
export type PersistedSettings = AgentSettingsState & {
    provider: UserAiProviderId;
    model: string;
    apiKey: string;
    baseUrl?: string;
    maxOutputTokens?: number;
    maxAgentSteps?: number;
    requestTimeoutMs?: number;
    defaultChatMode?: ChatInteractionMode;
};
export type SettingsSavePatch = Partial<AgentSettingsState> & {
    addAgent?: {
        name: string;
        provider: UserAiProviderId;
        model: string;
        apiKey: string;
        baseUrl?: string;
    };
    updatePreset?: {
        presetId: string;
        name?: string;
        maxOutputTokens?: number;
        maxAgentSteps?: number;
    };
    deletePresetId?: string;
};
type StoreShape = {
    settings: Record<string, unknown>;
    workspacePath: string;
    recentWorkspaces: string[];
    chatState: {
        sessions: ChatSession[];
        activeId: string;
    } | null;
    onboardingCompleted: boolean;
};
function toPersistedSettings(state: AgentSettingsState): PersistedSettings {
    const active = getActivePreset(state);
    return {
        ...state,
        provider: active?.provider ?? "openai",
        model: active?.model ?? "gpt-4.1-mini",
        apiKey: active?.apiKey ?? "",
        baseUrl: active?.baseUrl,
        maxOutputTokens: active?.maxOutputTokens,
        maxAgentSteps: active?.maxAgentSteps,
        requestTimeoutMs: undefined,
    };
}
function readState(): AgentSettingsState {
    const raw = store.get("settings") ?? {};
    return normalizeAgentSettings(raw as Partial<AgentSettingsState> & Record<string, unknown>);
}
function writeState(state: AgentSettingsState): PersistedSettings {
    const normalized = normalizeAgentSettings(state);
    store.set("settings", normalized);
    return toPersistedSettings(normalized);
}
export const store = new Store<StoreShape>({
    defaults: {
        settings: normalizeAgentSettings({
            language: "en",
            theme: "voidscribe",
            windowLayout: "editor",
            defaultChatMode: "agent",
        }),
        workspacePath: "",
        recentWorkspaces: [],
        chatState: null,
        onboardingCompleted: false,
    },
});
export function isOnboardingCompleted(): boolean {
    return store.get("onboardingCompleted") === true;
}
export function completeOnboarding(): void {
    store.set("onboardingCompleted", true);
}
export function getSettings(): PersistedSettings {
    return toPersistedSettings(readState());
}
export function saveSettings(patch: SettingsSavePatch = {}): PersistedSettings {
    let state = readState();
    if (patch.language !== undefined)
        state.language = patch.language;
    if (patch.theme !== undefined)
        state.theme = patch.theme;
    if (patch.windowLayout !== undefined)
        state.windowLayout = patch.windowLayout;
    if (patch.defaultChatMode !== undefined)
        state.defaultChatMode = patch.defaultChatMode;
    if (patch.activePresetId) {
        state = selectPreset(state, patch.activePresetId);
    }
    if (patch.deletePresetId) {
        state = deletePreset(state, patch.deletePresetId);
    }
    if (patch.addAgent) {
        state = addPreset(state, patch.addAgent);
    }
    if (patch.updatePreset) {
        state = updatePreset(state, patch.updatePreset);
    }
    return writeState(state);
}
export function getPresetById(presetId: string): AgentPreset | null {
    return readState().presets.find((item) => item.id === presetId) ?? null;
}
