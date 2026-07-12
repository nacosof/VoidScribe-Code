import { useEffect, useState } from "react";
import { getPresetLabel, getReadyPresets } from "@/lib/agent-presets";
import {
    isLocalProvider,
    LOCAL_API_KEY,
    providerById,
    providerRequiresApiKey,
    resolveProviderBaseUrl,
} from "@/lib/providers";
import { t } from "@/lib/i18n";
import type { AiSettings, LocalProviderStatus, SettingsSavePatch, UiLanguage } from "@/types";
import type { UserAiProviderId } from "@/lib/providers";
import { AddAgentSection } from "./AddAgentSection";
import { GeneralSettingsSection } from "./GeneralSettingsSection";
import { ManageAgentSection } from "./ManageAgentSection";
import { emptyAddForm, parseOptionalInt, type AddAgentForm, type SettingsSection } from "../lib/settings-form";

type Props = {
    settings: AiSettings;
    lang: UiLanguage;
    localDiscovery?: LocalProviderStatus[];
    providerModels?: string[];
    onBack: () => void;
    onChange: (patch: Partial<AiSettings>) => void;
    onSave: (patch: SettingsSavePatch) => Promise<boolean>;
    onRefreshModels?: (input?: {
        provider?: UserAiProviderId;
        apiKey?: string;
        baseUrl?: string;
    }) => Promise<void>;
    onDiscoverLocal?: () => Promise<void>;
};

export function SettingsScreen({
    settings,
    lang,
    localDiscovery = [],
    providerModels = [],
    onBack,
    onChange,
    onSave,
    onRefreshModels,
    onDiscoverLocal,
}: Props) {
    const [section, setSection] = useState<SettingsSection>("general");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const savedAgents = getReadyPresets(settings);
    const [editingId, setEditingId] = useState<string | null>(savedAgents[0]?.id ?? null);
    const [addForm, setAddForm] = useState<AddAgentForm>(emptyAddForm);
    const [manageName, setManageName] = useState("");
    const [maxOutputTokens, setMaxOutputTokens] = useState("");
    const [maxAgentSteps, setMaxAgentSteps] = useState("");
    const editingPreset = editingId
        ? settings.presets.find((item) => item.id === editingId)
        : undefined;
    const isAddLocal = isLocalProvider(addForm.provider);

    useEffect(() => {
        if (!editingPreset)
            return;
        setManageName(editingPreset.name);
        setMaxOutputTokens(editingPreset.maxOutputTokens?.toString() ?? "");
        setMaxAgentSteps(editingPreset.maxAgentSteps?.toString() ?? "");
    }, [editingPreset]);

    useEffect(() => {
        if (!editingId)
            return;
        if (!settings.presets.some((item) => item.id === editingId)) {
            setEditingId(getReadyPresets(settings)[0]?.id ?? null);
        }
    }, [settings.presets, editingId]);

    useEffect(() => {
        if (section !== "add" || !isAddLocal)
            return;
        void onDiscoverLocal?.();
        void onRefreshModels?.({
            provider: addForm.provider,
            apiKey: LOCAL_API_KEY,
            baseUrl: resolveProviderBaseUrl(addForm.provider, addForm.baseUrl),
        });
    }, [section, addForm.provider, addForm.baseUrl, isAddLocal, onDiscoverLocal, onRefreshModels]);

    useEffect(() => {
        if (section !== "add" || isAddLocal)
            return;
        void onRefreshModels?.({
            provider: addForm.provider,
            apiKey: addForm.apiKey,
            baseUrl: addForm.baseUrl,
        });
    }, [section, addForm.provider, isAddLocal, onRefreshModels]);

    function handleSectionChange(next: SettingsSection) {
        setSection(next);
        setError("");
        setSaved(false);
        if (next === "add") {
            setAddForm(emptyAddForm());
        }
        if (next === "manage") {
            const first = getReadyPresets(settings)[0];
            setEditingId(first?.id ?? null);
        }
    }

    function loadAgentForEdit(presetId: string) {
        const preset = settings.presets.find((item) => item.id === presetId);
        if (!preset)
            return;
        setEditingId(preset.id);
        setManageName(preset.name);
        setMaxOutputTokens(preset.maxOutputTokens?.toString() ?? "");
        setMaxAgentSteps(preset.maxAgentSteps?.toString() ?? "");
        setError("");
        setSaved(false);
    }

    async function handleSaveGeneral() {
        setError("");
        setSaved(false);
        setSaving(true);
        const ok = await onSave({
            language: settings.language,
            theme: settings.theme,
            windowLayout: settings.windowLayout,
        });
        setSaving(false);
        if (!ok) {
            setError(t(lang, "saving"));
            return;
        }
        setSaved(true);
    }

    async function handleAddAgent() {
        setError("");
        setSaved(false);
        const addProvider = providerById(addForm.provider);
        const showAddApiKey = providerRequiresApiKey(addForm.provider);
        if (showAddApiKey && !addForm.apiKey.trim()) {
            setError(t(lang, "errApiKeyRequired"));
            return;
        }
        if (isAddLocal && !addForm.model.trim()) {
            setError(t(lang, "errModelRequired"));
            return;
        }
        setSaving(true);
        const resolvedBaseUrl = resolveProviderBaseUrl(addForm.provider, addForm.baseUrl);
        const ok = await onSave({
            addAgent: {
                name: addForm.name.trim() || addForm.model.trim() || addProvider.defaultModel,
                provider: addForm.provider,
                model: addForm.model.trim() || addProvider.defaultModel,
                apiKey: isAddLocal ? LOCAL_API_KEY : addForm.apiKey.trim(),
                baseUrl: resolvedBaseUrl,
            },
        });
        setSaving(false);
        if (!ok) {
            setError(t(lang, "saving"));
            return;
        }
        setAddForm(emptyAddForm());
        setSaved(true);
    }

    async function handleDeleteAgent() {
        if (!editingId || !editingPreset)
            return;
        const label = getPresetLabel(editingPreset);
        if (!window.confirm(t(lang, "deleteAgentConfirm", label)))
            return;
        setError("");
        setSaved(false);
        setSaving(true);
        const ok = await onSave({ deletePresetId: editingId });
        setSaving(false);
        if (!ok) {
            setError(t(lang, "saving"));
            return;
        }
        setSaved(true);
    }

    async function handleUpdateAgent() {
        if (!editingId || !editingPreset) {
            setError(t(lang, "agentsEmpty"));
            return;
        }
        setError("");
        setSaved(false);
        const parsedMaxOutput = parseOptionalInt(maxOutputTokens);
        const parsedMaxSteps = parseOptionalInt(maxAgentSteps);
        if (Number.isNaN(parsedMaxOutput)) {
            setError(t(lang, "errInvalidMaxOutputTokens"));
            return;
        }
        if (Number.isNaN(parsedMaxSteps)) {
            setError(t(lang, "errInvalidMaxAgentSteps"));
            return;
        }
        setSaving(true);
        const ok = await onSave({
            updatePreset: {
                presetId: editingId,
                name: manageName.trim() || editingPreset.model,
                maxOutputTokens: parsedMaxOutput,
                maxAgentSteps: parsedMaxSteps,
            },
        });
        setSaving(false);
        if (!ok) {
            setError(t(lang, "saving"));
            return;
        }
        setSaved(true);
    }

    async function handleSave() {
        if (section === "general")
            await handleSaveGeneral();
        else if (section === "add")
            await handleAddAgent();
        else
            await handleUpdateAgent();
    }

    return (
        <section className="settings-screen">
            <div className="settings-shell">
                <nav className="settings-nav" aria-label={t(lang, "settingsTitle")}>
                    <button type="button" className="settings-nav__back" onClick={onBack}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                        {t(lang, "back")}
                    </button>
                    <div className="settings-nav__items">
                        <button type="button" className={`settings-nav__item${section === "general" ? " settings-nav__item--active" : ""}`} onClick={() => handleSectionChange("general")}>
                            {t(lang, "settingsNavGeneral")}
                        </button>
                        <button type="button" className={`settings-nav__item${section === "add" ? " settings-nav__item--active" : ""}`} onClick={() => handleSectionChange("add")}>
                            {t(lang, "settingsNavAddAgent")}
                        </button>
                        <button type="button" className={`settings-nav__item${section === "manage" ? " settings-nav__item--active" : ""}`} onClick={() => handleSectionChange("manage")}>
                            {t(lang, "settingsNavManageAgent")}
                        </button>
                    </div>
                </nav>
                <main className="settings-content">
                    <div className="settings-content__inner">
                        {section === "general" ? (
                            <GeneralSettingsSection settings={settings} lang={lang} onChange={onChange} />
                        ) : null}
                        {section === "add" ? (
                            <AddAgentSection
                                lang={lang}
                                form={addForm}
                                localDiscovery={localDiscovery}
                                providerModels={providerModels}
                                onChange={(patch) => setAddForm((prev) => ({ ...prev, ...patch }))}
                            />
                        ) : null}
                        {section === "manage" ? (
                            <ManageAgentSection
                                lang={lang}
                                savedAgents={savedAgents}
                                editingId={editingId}
                                editingPreset={editingPreset}
                                manageName={manageName}
                                maxOutputTokens={maxOutputTokens}
                                maxAgentSteps={maxAgentSteps}
                                onSelectAgent={loadAgentForEdit}
                                onManageNameChange={setManageName}
                                onMaxOutputTokensChange={setMaxOutputTokens}
                                onMaxAgentStepsChange={setMaxAgentSteps}
                            />
                        ) : null}

                        {error ? <p className="settings-screen__error">{error}</p> : null}
                        {saved ? <p className="settings-screen__success">{t(lang, "saved")}</p> : null}
                        <div className="settings-screen__actions">
                            {section === "manage" && editingPreset ? (
                                <button type="button" className="btn btn--ghost settings-screen__danger settings-screen__actions-delete" disabled={saving} onClick={() => void handleDeleteAgent()}>
                                    {t(lang, "deleteAgent")}
                                </button>
                            ) : null}
                            <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void handleSave()}>
                                {saving ? t(lang, "saving") : t(lang, "save")}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </section>
    );
}
