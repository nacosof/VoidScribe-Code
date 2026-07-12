import { DropdownSelect } from "@/components/DropdownSelect";
import { t, themeLabel } from "@/lib/i18n";
import type { AiSettings, UiLanguage, UiTheme, WindowLayout } from "@/types";

type GeneralSettingsSectionProps = {
    settings: AiSettings;
    lang: UiLanguage;
    onChange: (patch: Partial<AiSettings>) => void;
};

export function GeneralSettingsSection({ settings, lang, onChange }: GeneralSettingsSectionProps) {
    const layoutOptions: Array<{ value: WindowLayout; label: string; hint: string }> = [
        { value: "editor", label: t(lang, "layoutEditor"), hint: t(lang, "layoutEditorHint") },
        { value: "agent", label: t(lang, "layoutAgent"), hint: t(lang, "layoutAgentHint") },
    ];

    return (
        <>
            <header className="settings-page-head">
                <h1 className="settings-page-head__title">{t(lang, "generalTitle")}</h1>
                <p className="settings-page-head__desc">{t(lang, "generalDesc")}</p>
            </header>
            <div className="settings-fields">
                <div className="field">
                    <label htmlFor="window-layout">{t(lang, "windowLayout")}</label>
                    <DropdownSelect
                        id="window-layout"
                        value={settings.windowLayout ?? "editor"}
                        options={layoutOptions}
                        onChange={(value) => onChange({ windowLayout: value })}
                    />
                    <p className="field__hint">{t(lang, "layoutHint")}</p>
                </div>
                <div className="field">
                    <label htmlFor="ui-language">{t(lang, "uiLanguage")}</label>
                    <DropdownSelect
                        id="ui-language"
                        value={settings.language ?? "en"}
                        options={[
                            { value: "ru", label: t(lang, "langRu") },
                            { value: "en", label: t(lang, "langEn") },
                        ]}
                        onChange={(value) => onChange({ language: value })}
                    />
                </div>
                <div className="field">
                    <label htmlFor="ui-theme">{t(lang, "uiTheme")}</label>
                    <DropdownSelect
                        id="ui-theme"
                        value={settings.theme ?? "voidscribe"}
                        options={[
                            { value: "voidscribe", label: themeLabel(lang, "voidscribe") },
                            { value: "slate", label: themeLabel(lang, "slate") },
                            { value: "ocean", label: themeLabel(lang, "ocean") },
                        ]}
                        onChange={(value) => onChange({ theme: value as UiTheme })}
                    />
                </div>
            </div>
        </>
    );
}
