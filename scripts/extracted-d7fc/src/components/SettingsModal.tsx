import { useEffect, useState } from "react";
import {
  USER_AI_PROVIDER_CONFIG,
  USER_AI_PROVIDER_IDS,
  type UserAiProviderId,
} from "@/lib/providers";
import type { SettingsPublic } from "@/types";

type SettingsModalProps = {
  open: boolean;
  settings: SettingsPublic;
  onClose: () => void;
  onSaved: (settings: SettingsPublic) => void;
};

export function SettingsModal({
  open,
  settings,
  onClose,
  onSaved,
}: SettingsModalProps) {
  const [provider, setProvider] = useState<UserAiProviderId>(settings.provider);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(settings.model);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setProvider(settings.provider);
    setApiKey("");
    setModel(settings.model);
    setSystemPrompt(settings.systemPrompt);
    setError("");
  }, [open, settings]);

  useEffect(() => {
    const config = USER_AI_PROVIDER_CONFIG[provider];
    if (!model || model === settings.model) {
      setModel(config.defaultModel);
    }
  }, [provider, model, settings.model]);

  if (!open) return null;

  const config = USER_AI_PROVIDER_CONFIG[provider];

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const patch: {
        provider: UserAiProviderId;
        model: string;
        systemPrompt: string;
        apiKey?: string;
      } = {
        provider,
        model: model.trim() || config.defaultModel,
        systemPrompt,
      };

      if (apiKey.trim()) {
        patch.apiKey = apiKey.trim();
      } else if (!settings.hasApiKey) {
        setError("Введите API-ключ.");
        setSaving(false);
        return;
      }

      const next = await window.voidscribe.saveSettings(patch);
      onSaved(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Настройки API</h2>
        <p>
          Ключ хранится локально на вашем компьютере и уходит напрямую к
          выбранному провайдеру.
        </p>

        <div className="field">
          <label htmlFor="provider">Провайдер</label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as UserAiProviderId)}
          >
            {USER_AI_PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {USER_AI_PROVIDER_CONFIG[id].label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="apiKey">API-ключ</label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              settings.hasApiKey
                ? `Текущий: ${settings.apiKeyHint} (оставьте пустым, чтобы не менять)`
                : config.keyPlaceholder
            }
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="model">Модель</label>
          <input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={config.defaultModel}
          />
        </div>

        <div className="field">
          <label htmlFor="systemPrompt">Системный промпт</label>
          <textarea
            id="systemPrompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>

        {error ? (
          <p style={{ color: "var(--blood-ink)", fontSize: 13 }}>{error}</p>
        ) : null}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
