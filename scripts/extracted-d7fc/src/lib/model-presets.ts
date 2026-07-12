import {
  getUserAiProviderConfig,
  USER_AI_PROVIDER_CONFIG,
  type UserAiProviderId,
} from "./providers";
import type { AppSettings, ModelPreset } from "@/types";

export function createPresetId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getPresetLabel(preset: { name?: string; model: string }): string {
  const name = preset.name?.trim();
  return name || preset.model;
}

export function getActivePreset(settings: AppSettings): ModelPreset {
  const readyPresets = settings.presets.filter((item) => item.apiKey.trim());
  const preset =
    readyPresets.find((item) => item.id === settings.activePresetId) ??
    readyPresets[0];

  if (!preset) {
    const provider: UserAiProviderId = "openai";
    const model = getUserAiProviderConfig(provider).defaultModel;
    return {
      id: "",
      name: model,
      provider,
      model,
      apiKey: "",
    };
  }

  return preset;
}

function sanitizePresets(presets: ModelPreset[]): ModelPreset[] {
  return presets.filter((item) => item.apiKey.trim());
}

function mapRawPreset(item: Record<string, unknown>): ModelPreset {
  const model = String(item.model ?? "");
  const name =
    typeof item.name === "string" && item.name.trim()
      ? item.name.trim()
      : model;

  return {
    id: String(item.id),
    name,
    provider: item.provider as UserAiProviderId,
    model,
    apiKey: typeof item.apiKey === "string" ? item.apiKey : "",
  };
}

export function normalizeAppSettings(
  raw: Partial<AppSettings> & Record<string, unknown>
): AppSettings {
  const workspacePath =
    typeof raw.workspacePath === "string" ? raw.workspacePath : "";
  const systemPrompt =
    typeof raw.systemPrompt === "string" ? raw.systemPrompt : "";

  if (Array.isArray(raw.presets) && raw.presets.length > 0) {
    const presets = sanitizePresets(
      raw.presets.map((item) => mapRawPreset(item as Record<string, unknown>))
    );

    const activePresetId =
      typeof raw.activePresetId === "string" &&
      presets.some((item) => item.id === raw.activePresetId)
        ? raw.activePresetId
        : (presets[0]?.id ?? "");

    return { activePresetId, presets, workspacePath, systemPrompt };
  }

  const provider =
    typeof raw.provider === "string" &&
    raw.provider in USER_AI_PROVIDER_CONFIG
      ? (raw.provider as UserAiProviderId)
      : "openai";
  const model =
    typeof raw.model === "string" && raw.model.trim()
      ? raw.model.trim()
      : getUserAiProviderConfig(provider).defaultModel;
  const apiKey = typeof raw.apiKey === "string" ? raw.apiKey : "";

  if (!apiKey.trim()) {
    return {
      activePresetId: "",
      presets: [],
      workspacePath,
      systemPrompt,
    };
  }

  const id = createPresetId();

  return {
    activePresetId: id,
    presets: [{ id, name: model, provider, model, apiKey: apiKey.trim() }],
    workspacePath,
    systemPrompt,
  };
}

export function selectPreset(
  settings: AppSettings,
  presetId: string
): AppSettings {
  if (!settings.presets.some((item) => item.id === presetId)) {
    return settings;
  }

  return { ...settings, activePresetId: presetId };
}

export function deletePreset(
  settings: AppSettings,
  presetId: string
): AppSettings {
  const presets = settings.presets.filter((item) => item.id !== presetId);
  const activePresetId =
    settings.activePresetId === presetId
      ? (presets[0]?.id ?? "")
      : settings.activePresetId;

  return { ...settings, presets, activePresetId };
}

export function upsertPreset(
  settings: AppSettings,
  input: {
    name?: string;
    provider: UserAiProviderId;
    model: string;
    apiKey?: string;
    presetId?: string;
    createNew?: boolean;
  }
): AppSettings {
  const model = input.model.trim();
  const name = input.name?.trim() || model;

  const existing = input.createNew
    ? undefined
    : input.presetId
      ? settings.presets.find((item) => item.id === input.presetId)
      : settings.presets.find(
          (item) => item.provider === input.provider && item.model === model
        );

  if (existing) {
    const apiKey =
      typeof input.apiKey === "string" && input.apiKey.trim()
        ? input.apiKey.trim()
        : existing.apiKey;

    const presets = sanitizePresets(
      settings.presets.map((item) =>
        item.id === existing.id
          ? { ...item, name, provider: input.provider, model, apiKey }
          : item
      )
    );

    const activeId = presets.some((item) => item.id === existing.id)
      ? existing.id
      : (presets[0]?.id ?? "");

    return { ...settings, presets, activePresetId: activeId };
  }

  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) {
    return settings;
  }

  const preset: ModelPreset = {
    id: createPresetId(),
    name,
    provider: input.provider,
    model,
    apiKey,
  };

  return {
    ...settings,
    presets: [...settings.presets, preset],
    activePresetId: preset.id,
  };
}

export function toAiSettings(settings: AppSettings) {
  const preset = getActivePreset(settings);
  return {
    provider: preset.provider,
    model: preset.model,
    apiKey: preset.apiKey,
    workspacePath: settings.workspacePath,
    systemPrompt: settings.systemPrompt,
  };
}
