import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { DropdownSelect } from "./DropdownSelect";
import { getPresetLabel } from "@/lib/model-presets";
import {
  AGENT_ROLE_OPTIONS,
  getRoleLabel,
  type AgentRoleType,
} from "@/lib/agent-roles";
import {
  USER_AI_PROVIDER_CONFIG,
  USER_AI_PROVIDER_IDS,
  type UserAiProviderId,
} from "@/lib/providers";
import type { ModelPresetPublic, SettingsPublic, SettingsSaveInput } from "@/types";

type SettingsScreenProps = {
  settings: SettingsPublic;
  onBack: () => void;
  onSaved: (settings: SettingsPublic) => void;
};

type SettingsSection = "add" | "manage";

function emptyAgentForm() {
  const provider: UserAiProviderId = "openai";
  return {
    name: "",
    provider,
    model: USER_AI_PROVIDER_CONFIG[provider].defaultModel,
    apiKey: "",
    hasStoredKey: false,
    apiKeyHint: "",
  };
}

export function SettingsScreen({
  settings,
  onBack,
  onSaved,
}: SettingsScreenProps) {
  const savedAgents = settings.presets.filter((preset) => preset.hasApiKey);

  const [section, setSection] = useState<SettingsSection>("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<UserAiProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(
    USER_AI_PROVIDER_CONFIG.openai.defaultModel
  );
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [apiKeyHint, setApiKeyHint] = useState("");
  const [roleType, setRoleType] = useState<AgentRoleType>("developer");
  const [customRoleName, setCustomRoleName] = useState("");
  const [customRolePrompt, setCustomRolePrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const config = USER_AI_PROVIDER_CONFIG[provider];
  const providerOptions = USER_AI_PROVIDER_IDS.map((id) => ({
    value: id,
    label: USER_AI_PROVIDER_CONFIG[id].label,
  }));

  function resetAddForm() {
    const form = emptyAgentForm();
    setName(form.name);
    setProvider(form.provider);
    setModel(form.model);
    setApiKey(form.apiKey);
    setHasStoredKey(form.hasStoredKey);
    setApiKeyHint(form.apiKeyHint);
    setError("");
  }

  function loadAgentForEdit(preset: ModelPresetPublic) {
    setEditingId(preset.id);
    setName(preset.name);
    setProvider(preset.provider);
    setModel(preset.model);
    setApiKey("");
    setHasStoredKey(preset.hasApiKey);
    setApiKeyHint(preset.apiKeyHint);
    setRoleType(preset.roleType);
    setCustomRoleName(preset.customRoleName);
    setCustomRolePrompt(preset.customRolePrompt);
    setError("");
    setSuccess("");
  }

  function handleProviderChange(nextProvider: UserAiProviderId) {
    setProvider(nextProvider);
    if (section === "add") {
      setModel(USER_AI_PROVIDER_CONFIG[nextProvider].defaultModel);
    }
  }

  function handleSectionChange(next: SettingsSection) {
    setSection(next);
    setError("");
    setSuccess("");

    if (next === "add") {
      setEditingId(null);
      resetAddForm();
      return;
    }

    const first = savedAgents[0];
    if (first) {
      loadAgentForEdit(first);
    } else {
      setEditingId(null);
      resetAddForm();
    }
  }

  async function handleAddAgent() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!apiKey.trim()) {
        setError("Введите API-ключ.");
        setSaving(false);
        return;
      }

      const patch: SettingsSaveInput = {
        name: name.trim() || model.trim() || config.defaultModel,
        provider,
        model: model.trim() || config.defaultModel,
        apiKey: apiKey.trim(),
        addAsNewPreset: true,
        roleType: "developer",
      };

      const next = await window.voidscribe.saveSettings(patch);
      onSaved(next);
      resetAddForm();
      setSuccess("Агент успешно сохранён и добавлен в список агентов.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateAgent() {
    if (!editingId) return;

    if (roleType === "custom") {
      if (!customRoleName.trim()) {
        setError("Укажите название своей роли.");
        return;
      }
      if (!customRolePrompt.trim()) {
        setError("Напишите промпт для своей роли.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const patch: SettingsSaveInput = {
        presetId: editingId,
        name: name.trim() || model.trim() || config.defaultModel,
        roleType,
        customRoleName: roleType === "custom" ? customRoleName.trim() : "",
        customRolePrompt: roleType === "custom" ? customRolePrompt.trim() : "",
      };

      const next = await window.voidscribe.saveSettings(patch);
      onSaved(next);

      const updated = next.presets.find((preset) => preset.id === editingId);
      if (updated) {
        loadAgentForEdit(updated);
      }

      setSuccess("Изменения сохранены.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgent() {
    if (!editingId) return;

    setSaving(true);
    setError("");

    try {
      const next = await window.voidscribe.saveSettings({
        deletePresetId: editingId,
      });
      onSaved(next);
      setDeleteConfirmOpen(false);
      setSuccess("Агент удалён.");

      const remaining = next.presets.filter((preset) => preset.hasApiKey);
      const first = remaining[0];
      if (first) {
        loadAgentForEdit(first);
      } else {
        setEditingId(null);
        resetAddForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить.");
    } finally {
      setSaving(false);
    }
  }

  const editingPreset = editingId
    ? savedAgents.find((preset) => preset.id === editingId)
    : undefined;

  return (
    <div className="settings-screen">
      <div className="settings-shell">
        <aside className="settings-nav" aria-label="Разделы настроек">
          <button
            type="button"
            className="settings-nav__back"
            onClick={onBack}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Назад
          </button>

          <div className="settings-nav__items">
            <button
              type="button"
              className={`settings-nav__item${section === "add" ? " settings-nav__item--active" : ""}`}
              onClick={() => handleSectionChange("add")}
            >
              Добавление агента
            </button>
            <button
              type="button"
              className={`settings-nav__item${section === "manage" ? " settings-nav__item--active" : ""}`}
              onClick={() => handleSectionChange("manage")}
            >
              Настройки агента
            </button>
          </div>
        </aside>

        <div className="settings-content">
          <div className="settings-content__inner">
            {section === "add" ? (
              <>
                <header className="settings-page-head">
                  <h1 className="settings-page-head__title">Добавление агента</h1>
                  <p className="settings-page-head__desc">
                    Укажите провайдер, ключ и модель. Роль можно настроить после
                    добавления в списке агентов.
                  </p>
                </header>

                <AgentCredentialsFields
                  name={name}
                  provider={provider}
                  apiKey={apiKey}
                  model={model}
                  hasStoredKey={hasStoredKey}
                  apiKeyHint={apiKeyHint}
                  config={config}
                  providerOptions={providerOptions}
                  onNameChange={setName}
                  onProviderChange={handleProviderChange}
                  onApiKeyChange={setApiKey}
                  onModelChange={setModel}
                />

                {error ? (
                  <p className="settings-screen__error">{error}</p>
                ) : null}
                {success ? (
                  <p className="settings-screen__success">{success}</p>
                ) : null}

                <div className="settings-screen__actions">
                  <span />
                  <div className="settings-screen__actions-right">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void handleAddAgent()}
                      disabled={saving}
                    >
                      {saving ? "Сохранение…" : "Сохранить"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <header className="settings-page-head">
                  <h1 className="settings-page-head__title">Настройки агента</h1>
                  <p className="settings-page-head__desc">
                    Выберите агента и настройте название и роль. Провайдер,
                    ключ и модель меняются только при добавлении.
                  </p>
                </header>

                {savedAgents.length > 0 ? (
                  <ul className="settings-agent-list">
                    {savedAgents.map((preset) => (
                      <li key={preset.id}>
                        <button
                          type="button"
                          className={`settings-agent-list__item${editingId === preset.id ? " settings-agent-list__item--active" : ""}`}
                          onClick={() => loadAgentForEdit(preset)}
                        >
                          <span className="settings-agent-list__name">
                            {getPresetLabel(preset)}
                          </span>
                          <span className="settings-agent-list__meta">
                            {getRoleLabel(preset.roleType, preset.customRoleName)}{" "}
                            · {USER_AI_PROVIDER_CONFIG[preset.provider].label} ·{" "}
                            {preset.model}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="settings-agent-list__empty">
                    Агенты не добавлены. Создайте первого в разделе «Добавление
                    агента».
                  </p>
                )}

                {editingId && editingPreset ? (
                  <>
                    <h2 className="settings-subhead">Параметры агента</h2>

                    <p className="settings-agent-readonly">
                      {USER_AI_PROVIDER_CONFIG[editingPreset.provider].label} ·{" "}
                      {editingPreset.model}
                      {editingPreset.hasApiKey
                        ? ` · ключ ${editingPreset.apiKeyHint}`
                        : ""}
                    </p>

                    <AgentProfileFields
                      name={name}
                      roleType={roleType}
                      customRoleName={customRoleName}
                      customRolePrompt={customRolePrompt}
                      onNameChange={setName}
                      onRoleTypeChange={setRoleType}
                      onCustomRoleNameChange={setCustomRoleName}
                      onCustomRolePromptChange={setCustomRolePrompt}
                    />

                    <div className="settings-screen__actions">
                      <button
                        type="button"
                        className="btn btn--ghost settings-screen__danger"
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={saving}
                      >
                        Удалить
                      </button>
                      <div className="settings-screen__actions-right">
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => void handleUpdateAgent()}
                          disabled={saving}
                        >
                          {saving ? "Сохранение…" : "Сохранить"}
                        </button>
                      </div>
                    </div>

                    {error ? (
                      <p className="settings-screen__error">{error}</p>
                    ) : null}
                    {success ? (
                      <p className="settings-screen__success">{success}</p>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Удалить агента?"
        message="Агент будет удалён вместе с сохранённым ключом. Это действие нельзя отменить."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        loading={saving}
        onCancel={() => {
          if (!saving) setDeleteConfirmOpen(false);
        }}
        onConfirm={() => void handleDeleteAgent()}
      />
    </div>
  );
}

type AgentCredentialsFieldsProps = {
  name: string;
  provider: UserAiProviderId;
  apiKey: string;
  model: string;
  hasStoredKey: boolean;
  apiKeyHint: string;
  config: (typeof USER_AI_PROVIDER_CONFIG)[UserAiProviderId];
  providerOptions: { value: UserAiProviderId; label: string }[];
  onNameChange: (value: string) => void;
  onProviderChange: (value: UserAiProviderId) => void;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
};

function AgentCredentialsFields({
  name,
  provider,
  apiKey,
  model,
  hasStoredKey,
  apiKeyHint,
  config,
  providerOptions,
  onNameChange,
  onProviderChange,
  onApiKeyChange,
  onModelChange,
}: AgentCredentialsFieldsProps) {
  return (
    <div className="settings-fields">
      <div className="field">
        <label htmlFor="agentName">Название</label>
        <input
          id="agentName"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Cerebras"
        />
      </div>

      <div className="field">
        <label htmlFor="provider">Провайдер</label>
        <DropdownSelect
          id="provider"
          value={provider}
          options={providerOptions}
          onChange={onProviderChange}
          direction="down"
        />
      </div>

      <div className="field">
        <label htmlFor="apiKey">API-ключ</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={
            hasStoredKey
              ? `Текущий: ${apiKeyHint} (оставьте пустым, чтобы не менять)`
              : config.keyPlaceholder
          }
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="model">ID модели API</label>
        <input
          id="model"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={config.defaultModel}
        />
      </div>
    </div>
  );
}

type AgentProfileFieldsProps = {
  name: string;
  roleType: AgentRoleType;
  customRoleName: string;
  customRolePrompt: string;
  onNameChange: (value: string) => void;
  onRoleTypeChange: (value: AgentRoleType) => void;
  onCustomRoleNameChange: (value: string) => void;
  onCustomRolePromptChange: (value: string) => void;
};

function AgentProfileFields({
  name,
  roleType,
  customRoleName,
  customRolePrompt,
  onNameChange,
  onRoleTypeChange,
  onCustomRoleNameChange,
  onCustomRolePromptChange,
}: AgentProfileFieldsProps) {
  return (
    <div className="settings-fields">
      <div className="field">
        <label htmlFor="agentProfileName">Название агента</label>
        <input
          id="agentProfileName"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Мой агент"
        />
      </div>

      <div className="field">
        <label htmlFor="agentRole">Роль</label>
        <DropdownSelect
          id="agentRole"
          value={roleType}
          options={AGENT_ROLE_OPTIONS}
          onChange={onRoleTypeChange}
          direction="down"
        />
        {roleType !== "custom" ? (
          <p className="field__hint">
            К модели будет добавлен готовый системный промпт для выбранной роли.
          </p>
        ) : null}
      </div>

      {roleType === "custom" ? (
        <>
          <div className="field">
            <label htmlFor="customRoleName">Название роли</label>
            <input
              id="customRoleName"
              value={customRoleName}
              onChange={(e) => onCustomRoleNameChange(e.target.value)}
              placeholder="Ментор по React"
            />
          </div>

          <div className="field">
            <label htmlFor="customRolePrompt">Промпт роли</label>
            <textarea
              id="customRolePrompt"
              className="field__textarea-grow"
              rows={5}
              value={customRolePrompt}
              onChange={(e) => onCustomRolePromptChange(e.target.value)}
              placeholder="Опишите, как агент должен себя вести и что уметь…"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
