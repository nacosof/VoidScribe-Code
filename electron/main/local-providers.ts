import { isLocalProvider, type UserAiProviderId } from "../../src/lib/providers";
import type { PersistedSettings } from "./store";
export type LocalProviderId = "ollama" | "lmstudio";
export type LocalProviderStatus = {
    provider: LocalProviderId;
    online: boolean;
    baseUrl: string;
    models: string[];
    error?: string;
};
const DEFAULT_OLLAMA_ROOT = "http://127.0.0.1:11434";
const DEFAULT_LMSTUDIO_ROOT = "http://127.0.0.1:1234";
const PROBE_TIMEOUT_MS = 2500;
function normalizeRootUrl(value: string | undefined, fallback: string): string {
    const trimmed = value?.trim() || fallback;
    return trimmed.replace(/\/+$/, "").replace(/\/v1$/i, "");
}
async function fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as T;
    }
    finally {
        clearTimeout(timer);
    }
}
export async function probeOllama(baseUrl?: string): Promise<LocalProviderStatus> {
    const root = normalizeRootUrl(baseUrl, DEFAULT_OLLAMA_ROOT);
    try {
        const payload = await fetchJson<{
            models?: Array<{
                name?: string;
            }>;
        }>(`${root}/api/tags`);
        const models = (payload.models ?? [])
            .map((item) => item.name?.trim())
            .filter((name): name is string => Boolean(name));
        return {
            provider: "ollama",
            online: models.length > 0,
            baseUrl: `${root}/v1`,
            models,
        };
    }
    catch (err) {
        return {
            provider: "ollama",
            online: false,
            baseUrl: `${root}/v1`,
            models: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
export async function probeLmStudio(baseUrl?: string): Promise<LocalProviderStatus> {
    const root = normalizeRootUrl(baseUrl, DEFAULT_LMSTUDIO_ROOT);
    try {
        const payload = await fetchJson<{
            data?: Array<{
                id?: string;
            }>;
        }>(`${root}/v1/models`);
        const models = (payload.data ?? [])
            .map((item) => item.id?.trim())
            .filter((id): id is string => Boolean(id));
        return {
            provider: "lmstudio",
            online: models.length > 0,
            baseUrl: `${root}/v1`,
            models,
        };
    }
    catch (err) {
        return {
            provider: "lmstudio",
            online: false,
            baseUrl: `${root}/v1`,
            models: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
export async function discoverLocalProviders(input?: {
    ollamaBaseUrl?: string;
    lmstudioBaseUrl?: string;
}): Promise<LocalProviderStatus[]> {
    const [ollama, lmstudio] = await Promise.all([
        probeOllama(input?.ollamaBaseUrl),
        probeLmStudio(input?.lmstudioBaseUrl),
    ]);
    return [ollama, lmstudio];
}
export function applyLocalAutoConnect(settings: PersistedSettings, discovery: LocalProviderStatus[]): PersistedSettings {
    const next: PersistedSettings = { ...settings };
    const ollama = discovery.find((item) => item.provider === "ollama");
    const lmstudio = discovery.find((item) => item.provider === "lmstudio");
    function applyBaseUrl(provider: LocalProviderId, status: LocalProviderStatus | undefined) {
        if (!status?.online)
            return;
        if (next.provider !== provider)
            return;
        if (!next.baseUrl?.trim()) {
            next.baseUrl = status.baseUrl;
        }
    }
    applyBaseUrl("ollama", ollama);
    applyBaseUrl("lmstudio", lmstudio);
    if (!next.apiKey?.trim() && !isLocalProvider(next.provider)) {
        if (ollama?.online) {
            next.provider = "ollama";
            if (!next.baseUrl?.trim())
                next.baseUrl = ollama.baseUrl;
            return next;
        }
        if (lmstudio?.online) {
            next.provider = "lmstudio";
            if (!next.baseUrl?.trim())
                next.baseUrl = lmstudio.baseUrl;
        }
    }
    return next;
}
export function localProviderFromId(provider: UserAiProviderId): LocalProviderId | null {
    if (provider === "ollama")
        return "ollama";
    if (provider === "lmstudio")
        return "lmstudio";
    return null;
}
export function providerUsesLocalDiscovery(provider: UserAiProviderId): boolean {
    return isLocalProvider(provider);
}
