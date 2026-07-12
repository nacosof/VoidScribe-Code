import { DropdownSelect } from "@/components/DropdownSelect";
import { t } from "@/lib/i18n";
import {
    AI_PROVIDERS,
    isLocalProvider,
    LOCAL_PROVIDER_DEFAULTS,
    providerById,
    providerRequiresApiKey,
    type UserAiProviderId,
} from "@/lib/providers";
import type { LocalProviderStatus, UiLanguage } from "@/types";
import type { AddAgentForm } from "../lib/settings-form";

type AddAgentSectionProps = {
    lang: UiLanguage;
    form: AddAgentForm;
    localDiscovery: LocalProviderStatus[];
    providerModels: string[];
    onChange: (patch: Partial<AddAgentForm>) => void;
};

export function AddAgentSection({
    lang,
    form,
    localDiscovery,
    providerModels,
    onChange,
}: AddAgentSectionProps) {
    const addProvider = providerById(form.provider);
    const showAddApiKey = providerRequiresApiKey(form.provider);
    const showAddBaseUrl = addProvider.needsBaseUrl ||
        form.provider === "openrouter" ||
        isLocalProvider(form.provider);
    const isAddLocal = isLocalProvider(form.provider);
    const addLocalStatus = isAddLocal
        ? localDiscovery.find((item) => item.provider === form.provider)
        : undefined;
    const addCloudModelOptions = !isAddLocal && providerModels.length > 1 ? providerModels : [];

    return (
        <>
            <header className="settings-page-head">
                <h1 className="settings-page-head__title">{t(lang, "addAgentTitle")}</h1>
                <p className="settings-page-head__desc">{t(lang, "addAgentDesc")}</p>
            </header>
            <div className="settings-fields">
                <div className="field">
                    <label htmlFor="agent-name">{t(lang, "fieldAgentName")}</label>
                    <input
                        id="agent-name"
                        value={form.name}
                        onChange={(e) => onChange({ name: e.target.value })}
                        placeholder={t(lang, "agentNamePlaceholder")}
                    />
                </div>
                <div className="field">
                    <label htmlFor="provider">{t(lang, "fieldProvider")}</label>
                    <DropdownSelect
                        id="provider"
                        value={form.provider}
                        options={AI_PROVIDERS.map((item) => ({ value: item.id, label: item.label }))}
                        onChange={(next) => {
                            const providerId = next as UserAiProviderId;
                            onChange({
                                provider: providerId,
                                model: "",
                                baseUrl: "",
                                apiKey: "",
                            });
                        }}
                    />
                </div>
                {showAddApiKey ? (
                    <div className="field">
                        <label htmlFor="api-key">{t(lang, "fieldApiKey")}</label>
                        <input
                            id="api-key"
                            type="password"
                            value={form.apiKey}
                            onChange={(e) => onChange({ apiKey: e.target.value })}
                            autoComplete="off"
                        />
                    </div>
                ) : null}
                {addLocalStatus ? (
                    <p className={`field__hint${addLocalStatus.online ? " settings-screen__local--online" : " settings-screen__local--offline"}`}>
                        {addLocalStatus.online
                            ? t(lang, "localProviderOnline", addLocalStatus.models.length)
                            : t(lang, "localProviderOffline")}
                    </p>
                ) : null}
                <div className="field">
                    <label htmlFor="model">{t(lang, "fieldModel")}</label>
                    {isAddLocal ? (
                        <>
                            <input
                                id="model"
                                value={form.model}
                                onChange={(e) => onChange({ model: e.target.value })}
                                placeholder={t(lang, "localModelPlaceholder")}
                            />
                            <p className="field__hint">{t(lang, "localModelHint")}</p>
                        </>
                    ) : addCloudModelOptions.length > 1 ? (
                        <DropdownSelect
                            id="model"
                            value={form.model || addCloudModelOptions[0]!}
                            options={addCloudModelOptions.map((item) => ({ value: item, label: item }))}
                            onChange={(value) => onChange({ model: value })}
                        />
                    ) : (
                        <input
                            id="model"
                            value={form.model}
                            onChange={(e) => onChange({ model: e.target.value })}
                            placeholder={addProvider.defaultModel}
                        />
                    )}
                </div>
                {showAddBaseUrl ? (
                    <div className="field">
                        <label htmlFor="base-url">{t(lang, "fieldBaseUrl")}</label>
                        <input
                            id="base-url"
                            value={form.baseUrl}
                            onChange={(e) => onChange({ baseUrl: e.target.value })}
                            placeholder={
                                form.provider === "ollama"
                                    ? LOCAL_PROVIDER_DEFAULTS.ollama
                                    : form.provider === "lmstudio"
                                        ? LOCAL_PROVIDER_DEFAULTS.lmstudio
                                        : undefined
                            }
                        />
                        {isAddLocal ? <p className="field__hint">{t(lang, "localBaseUrlHint")}</p> : null}
                    </div>
                ) : null}
            </div>
        </>
    );
}
