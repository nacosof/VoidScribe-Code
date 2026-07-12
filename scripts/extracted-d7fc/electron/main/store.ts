import Store from "electron-store";
import {
  getActivePreset,
  normalizeAppSettings,
  selectPreset,
  upsertPreset,
} from "../../src/lib/model-presets";
import { getUserAiProviderConfig } from "../../src/lib/providers";
import type { AppSettings, ModelPresetPublic } from "../../src/types";

const DEFAULT_SYSTEM_PROMPT = `Ты VoidScribe Code — локальный AI-ассистент для разработки.
Помогай писать, чинить и объяснять код. Отвечай по-русски, если пользователь пишет по-русски.
Будь конкретным: предлагай готовые фрагменты кода, шаги и команды.
Если не хватает контекста — задай уточняющий вопрос.`;

const openAiDefault = getUserAiProviderConfig("openai").defaultModel;

const defaults: AppSettings = normalizeAppSettings({
  activePresetId: "",
  presets: [],
  workspacePath: "",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  provider: "openai",
  model: openAiDefault,
  apiKey: "",
});

export const settingsStore = new Store<AppSettings>({
  name: "voidscribe-code-settings",
  defaults,
});

function getNormalizedStore(): AppSettings {
  const normalized = normalizeAppSettings(settingsStore.store);
  if (JSON.stringify(normalized) !== JSON.stringify(settingsStore.store)) {
    settingsStore.store = normalized;
  }
  return normalized;
}

export function maskApiKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return trimmed;
  return `…${trimmed.slice(-4)}`;
}

function toPublicPreset(preset: AppSettings["presets"][number]): ModelPresetPublic {
  const apiKey = preset.apiKey.trim();
  return {
    id: preset.id,
    provider: preset.provider,
    model: preset.model,
    hasApiKey: Boolean(apiKey),
    apiKeyHint: maskApiKeyHint(apiKey),
  };
}

export function toPublicSettings(settings: AppSettings = getNormalizedStore()) {
  const active = getActivePreset(settings);
  const apiKey = active.apiKey.trim();

  return {
    activePresetId: settings.activePresetId,
    presets: settings.presets.map(toPublicPreset),
    workspacePath: settings.workspacePath,
    systemPrompt: settings.systemPrompt,
    provider: active.provider,
    model: active.model,
    hasApiKey: Boolean(apiKey),
    apiKeyHint: maskApiKeyHint(apiKey),
  };
}

export { getNormalizedStore, selectPreset, upsertPreset };
