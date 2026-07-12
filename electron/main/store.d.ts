import Store from "electron-store";
import type { UserAiProviderId } from "../../src/lib/providers";
export type PersistedSettings = {
    provider: UserAiProviderId;
    model: string;
    apiKey: string;
    baseUrl?: string;
    maxOutputTokens?: number;
    maxAgentSteps?: number;
    requestTimeoutMs?: number;
    language?: "en" | "ru";
    theme?: string;
};
type StoreShape = {
    settings: PersistedSettings;
    workspacePath: string;
    recentWorkspaces: string[];
};
export declare const store: Store<StoreShape>;
export declare function getSettings(): PersistedSettings;
export declare function saveSettings(patch: Partial<PersistedSettings>): PersistedSettings;
export {};
