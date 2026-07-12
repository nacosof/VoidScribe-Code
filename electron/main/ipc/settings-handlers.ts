import { ipcMain } from "electron";
import { applyLocalAutoConnect, discoverLocalProviders } from "../local-providers";
import { listProviderModels } from "../ai";
import { getSettings, saveSettings, store, isOnboardingCompleted, completeOnboarding } from "../store";
import { loadChatPersistedState, saveChatPersistedState, type ChatPersistedState } from "../chat-persist";
import type { IpcContext } from "./context";
import { fail, ok } from "./context";

export function registerSettingsHandlers(ctx: IpcContext): void {
    ipcMain.handle("settings:get", async () => {
        const discovery = await discoverLocalProviders();
        const settings = applyLocalAutoConnect(getSettings(), discovery);
        if (JSON.stringify(settings) !== JSON.stringify(getSettings())) {
            saveSettings(settings);
        }
        let onboardingCompleted = isOnboardingCompleted();
        if (!onboardingCompleted) {
            const hasWorkspace = Boolean(ctx.getWorkspacePath().trim());
            const hasRecent = (store.get("recentWorkspaces") ?? []).length > 0;
            if (hasWorkspace || hasRecent) {
                completeOnboarding();
                onboardingCompleted = true;
            }
        }
        return ok({
            settings,
            workspacePath: ctx.getWorkspacePath(),
            recentWorkspaces: store.get("recentWorkspaces"),
            localDiscovery: discovery,
            chatState: loadChatPersistedState(),
            onboardingCompleted,
        });
    });

    ipcMain.handle("chat:save", (_e, payload: ChatPersistedState) => {
        saveChatPersistedState(payload);
        return ok({});
    });

    ipcMain.handle("settings:save", (_e, patch) => ok({ settings: saveSettings(patch ?? {}) }));

    ipcMain.handle("onboarding:complete", () => {
        completeOnboarding();
        return ok({});
    });

    ipcMain.handle("ai:discoverLocal", async (_e, input?: {
        ollamaBaseUrl?: string;
        lmstudioBaseUrl?: string;
    }) => ok({ discovery: await discoverLocalProviders(input) }));

    ipcMain.handle("ai:listModels", async (_e, override?: {
        provider?: string;
        apiKey?: string;
        baseUrl?: string;
    }) => {
        try {
            const base = getSettings();
            const settings = {
                ...base,
                ...(override?.provider ? { provider: override.provider } : {}),
                ...(override?.apiKey !== undefined ? { apiKey: override.apiKey } : {}),
                ...(override?.baseUrl !== undefined ? { baseUrl: override.baseUrl } : {}),
            };
            return ok({ models: await listProviderModels(settings as import("../ai").AiRuntimeSettings) });
        }
        catch (err) {
            return fail(err);
        }
    });
}
