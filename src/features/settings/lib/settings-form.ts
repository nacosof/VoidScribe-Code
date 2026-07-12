import type { UserAiProviderId } from "@/lib/providers";

export type SettingsSection = "general" | "add" | "manage";

export type AddAgentForm = {
    name: string;
    provider: UserAiProviderId;
    model: string;
    apiKey: string;
    baseUrl: string;
};

export function parseOptionalInt(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
}

export function emptyAddForm(): AddAgentForm {
    return {
        name: "",
        provider: "openai",
        model: "",
        apiKey: "",
        baseUrl: "",
    };
}
