import { getPresetLabel, maskApiKeyHint, type AgentPreset } from "@/lib/agent-presets";
import { isLocalProvider, providerById } from "@/lib/providers";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type ManageAgentSectionProps = {
    lang: UiLanguage;
    savedAgents: AgentPreset[];
    editingId: string | null;
    editingPreset: AgentPreset | undefined;
    manageName: string;
    maxOutputTokens: string;
    maxAgentSteps: string;
    onSelectAgent: (presetId: string) => void;
    onManageNameChange: (value: string) => void;
    onMaxOutputTokensChange: (value: string) => void;
    onMaxAgentStepsChange: (value: string) => void;
};

export function ManageAgentSection({
    lang,
    savedAgents,
    editingId,
    editingPreset,
    manageName,
    maxOutputTokens,
    maxAgentSteps,
    onSelectAgent,
    onManageNameChange,
    onMaxOutputTokensChange,
    onMaxAgentStepsChange,
}: ManageAgentSectionProps) {
    return (
        <>
            <header className="settings-page-head">
                <h1 className="settings-page-head__title">{t(lang, "manageAgentTitle")}</h1>
                <p className="settings-page-head__desc">{t(lang, "manageAgentSelectDesc")}</p>
            </header>

            {savedAgents.length > 0 ? (
                <ul className="settings-agent-list">
                    {savedAgents.map((preset) => (
                        <li key={preset.id}>
                            <button
                                type="button"
                                className={`settings-agent-list__item${editingId === preset.id ? " settings-agent-list__item--active" : ""}`}
                                onClick={() => onSelectAgent(preset.id)}
                            >
                                <span className="settings-agent-list__name">{getPresetLabel(preset)}</span>
                                <span className="settings-agent-list__meta">
                                    {providerById(preset.provider).label} · {preset.model}
                                    {!isLocalProvider(preset.provider) && preset.apiKey
                                        ? ` · ${maskApiKeyHint(preset.apiKey)}`
                                        : ""}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="settings-agent-list__empty">{t(lang, "agentsEmpty")}</p>
            )}

            {editingPreset ? (
                <>
                    <p className="settings-agent-readonly">
                        {providerById(editingPreset.provider).label} · {editingPreset.model}
                    </p>
                    <div className="settings-fields">
                        <div className="field">
                            <label htmlFor="manage-agent-name">{t(lang, "fieldAgentName")}</label>
                            <input
                                id="manage-agent-name"
                                value={manageName}
                                onChange={(e) => onManageNameChange(e.target.value)}
                                placeholder={t(lang, "agentNamePlaceholder")}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="max-output">{t(lang, "fieldMaxOutputTokens")}</label>
                            <input
                                id="max-output"
                                value={maxOutputTokens}
                                placeholder={t(lang, "maxOutputTokensPlaceholder")}
                                onChange={(e) => onMaxOutputTokensChange(e.target.value)}
                            />
                            <p className="field__hint">{t(lang, "maxOutputTokensHint")}</p>
                        </div>
                        <div className="field">
                            <label htmlFor="max-steps">{t(lang, "fieldMaxAgentSteps")}</label>
                            <input
                                id="max-steps"
                                value={maxAgentSteps}
                                placeholder={t(lang, "maxAgentStepsPlaceholder")}
                                onChange={(e) => onMaxAgentStepsChange(e.target.value)}
                            />
                            <p className="field__hint">{t(lang, "maxAgentStepsHint")}</p>
                        </div>
                    </div>
                </>
            ) : null}
        </>
    );
}
