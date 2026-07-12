import { useCallback, useEffect, useState } from "react";
import { APP_MARK_URL } from "@/lib/assets";
import { t, themeLabel } from "@/lib/i18n";
import { THEMES, type ThemeId } from "@/lib/themes";
import type { UiLanguage, UiTheme } from "@/types";

type OnboardingStep = "language" | "theme" | "workspace";
type CreateMode = "folder" | "file" | null;

export type OnboardingFinishPayload = {
    language: UiLanguage;
    theme: UiTheme;
    workspacePath?: string;
    recentWorkspaces?: string[];
    filePath?: string;
};

type OnboardingWizardProps = {
    initialTheme?: UiTheme;
    onLanguageChange?: (language: UiLanguage) => void;
    onThemeChange?: (theme: UiTheme) => void;
    onFinish: (payload: OnboardingFinishPayload) => void | Promise<void>;
};

const STEPS: OnboardingStep[] = ["language", "theme", "workspace"];

export function OnboardingWizard({ initialTheme = "voidscribe", onLanguageChange, onThemeChange, onFinish }: OnboardingWizardProps) {
    const [step, setStep] = useState<OnboardingStep>("language");
    const [language, setLanguage] = useState<UiLanguage>("en");
    const [theme, setTheme] = useState<UiTheme>(initialTheme);
    const [createMode, setCreateMode] = useState<CreateMode>(null);
    const [createName, setCreateName] = useState("");
    const [parentPath, setParentPath] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const lang = language;
    const stepIndex = STEPS.indexOf(step);

    useEffect(() => {
        onLanguageChange?.(language);
    }, [language, onLanguageChange]);

    useEffect(() => {
        onThemeChange?.(theme);
    }, [theme, onThemeChange]);

    const finish = useCallback(async (payload: OnboardingFinishPayload) => {
        setBusy(true);
        try {
            await onFinish(payload);
        }
        finally {
            setBusy(false);
        }
    }, [onFinish]);

    const persistPreferences = useCallback(async () => {
        await window.voidscribe.saveSettings({ language, theme });
        await window.voidscribe.completeOnboarding();
    }, [language, theme]);

    const handleSkip = useCallback(async () => {
        setBusy(true);
        try {
            await persistPreferences();
            await onFinish({ language, theme });
        }
        finally {
            setBusy(false);
        }
    }, [language, onFinish, persistPreferences, theme]);

    const handleOpenFolder = useCallback(async () => {
        setError("");
        setBusy(true);
        try {
            const result = await window.voidscribe.pickWorkspace();
            if (!result.ok) {
                if (result.error !== "cancelled")
                    setError(result.error);
                return;
            }
            await persistPreferences();
            await finish({
                language,
                theme,
                workspacePath: result.workspacePath,
                recentWorkspaces: result.recentWorkspaces,
            });
        }
        finally {
            setBusy(false);
        }
    }, [finish, language, persistPreferences, theme]);

    const handleOpenFile = useCallback(async () => {
        setError("");
        setBusy(true);
        try {
            const result = await window.voidscribe.pickWorkspaceFile();
            if (!result.ok) {
                if (result.error !== "cancelled")
                    setError(result.error);
                return;
            }
            await persistPreferences();
            await finish({
                language,
                theme,
                workspacePath: result.workspacePath,
                recentWorkspaces: result.recentWorkspaces,
                filePath: result.filePath,
            });
        }
        finally {
            setBusy(false);
        }
    }, [finish, language, persistPreferences, theme]);

    const handlePickLocation = useCallback(async () => {
        setError("");
        const result = await window.voidscribe.pickParentDirectory();
        if (!result.ok) {
            if (result.error !== "cancelled")
                setError(result.error);
            return;
        }
        setParentPath(result.parentPath);
    }, []);

    const handleCreateAndOpen = useCallback(async () => {
        if (!createName.trim()) {
            setError(t(lang, "onboardingErrNameRequired"));
            return;
        }
        if (!parentPath.trim()) {
            setError(t(lang, "onboardingErrLocationRequired"));
            return;
        }
        setError("");
        setBusy(true);
        try {
            if (createMode === "folder") {
                const result = await window.voidscribe.createProjectFolder(parentPath, createName);
                if (!result.ok) {
                    setError(result.error);
                    return;
                }
                await persistPreferences();
                await finish({
                    language,
                    theme,
                    workspacePath: result.workspacePath,
                    recentWorkspaces: result.recentWorkspaces,
                });
                return;
            }
            const result = await window.voidscribe.createProjectFile(parentPath, createName);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            await persistPreferences();
            await finish({
                language,
                theme,
                workspacePath: result.workspacePath,
                recentWorkspaces: result.recentWorkspaces,
                filePath: result.filePath,
            });
        }
        finally {
            setBusy(false);
        }
    }, [createMode, createName, finish, lang, language, parentPath, persistPreferences, theme]);

    return (
        <div className="onboarding-screen">
            <div className="onboarding-card">
                <header className="onboarding-hero">
                    <h1 className="onboarding-hero__title">{t(lang, "onboardingWelcome")}</h1>
                    <div className="onboarding-hero__rule" aria-hidden />
                    <div className={`onboarding-hero__icon-wrap${theme === "slate" || theme === "ocean" ? " onboarding-hero__icon-wrap--backdrop" : ""}`}>
                        <img className="onboarding-hero__icon" src={APP_MARK_URL} alt="" />
                    </div>
                    <div className="onboarding-steps" aria-label="Onboarding steps">
                        {STEPS.map((item, index) => (
                            <span
                                key={item}
                                className={[
                                    "onboarding-steps__item",
                                    index === stepIndex ? "onboarding-steps__item--active" : "",
                                    index < stepIndex ? "onboarding-steps__item--done" : "",
                                ].filter(Boolean).join(" ")}
                            >
                                {item === "language" ? t(lang, "onboardingStepLanguage")
                                    : item === "theme" ? t(lang, "onboardingStepTheme")
                                        : t(lang, "onboardingStepWorkspace")}
                            </span>
                        ))}
                    </div>
                </header>

                {step === "language" ? (
                    <section className="onboarding-section">
                        <h1>{t(lang, "onboardingLanguageTitle")}</h1>
                        <p>{t(lang, "onboardingLanguageDesc")}</p>
                        <div className="onboarding-options onboarding-options--grid-2">
                            {(["en", "ru"] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={`onboarding-option${language === value ? " onboarding-option--active" : ""}`}
                                    onClick={() => setLanguage(value)}
                                >
                                    <span className="onboarding-option__title">
                                        {value === "en" ? "English" : "Русский"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                ) : null}

                {step === "theme" ? (
                    <section className="onboarding-section">
                        <h1>{t(lang, "onboardingThemeTitle")}</h1>
                        <p>{t(lang, "onboardingThemeDesc")}</p>
                        <div className="onboarding-options onboarding-options--grid-3">
                            {THEMES.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={`onboarding-option onboarding-option--theme onboarding-option--theme-${value}${theme === value ? " onboarding-option--active" : ""}`}
                                    onClick={() => setTheme(value as ThemeId)}
                                >
                                    <span className={`onboarding-theme-preview onboarding-theme-preview--${value}`} aria-hidden />
                                    <span className="onboarding-option__title">{themeLabel(lang, value)}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                ) : null}

                {step === "workspace" ? (
                    <section className="onboarding-section">
                        <h1>{t(lang, "onboardingWorkspaceTitle")}</h1>
                        <p>{t(lang, "onboardingWorkspaceDesc")}</p>
                        {!createMode ? (
                            <div className="onboarding-options onboarding-options--grid-2">
                                <button type="button" className="onboarding-option" disabled={busy} onClick={() => void handleOpenFolder()}>
                                    <span className="onboarding-option__title">{t(lang, "openFolder")}</span>
                                </button>
                                <button type="button" className="onboarding-option" disabled={busy} onClick={() => void handleOpenFile()}>
                                    <span className="onboarding-option__title">{t(lang, "fileMenuOpenFile")}</span>
                                </button>
                                <button
                                    type="button"
                                    className="onboarding-option"
                                    disabled={busy}
                                    onClick={() => {
                                        setCreateMode("folder");
                                        setCreateName("");
                                        setParentPath("");
                                        setError("");
                                    }}
                                >
                                    <span className="onboarding-option__title">{t(lang, "onboardingCreateFolder")}</span>
                                </button>
                                <button
                                    type="button"
                                    className="onboarding-option"
                                    disabled={busy}
                                    onClick={() => {
                                        setCreateMode("file");
                                        setCreateName("");
                                        setParentPath("");
                                        setError("");
                                    }}
                                >
                                    <span className="onboarding-option__title">{t(lang, "onboardingCreateFile")}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="onboarding-create-form">
                                <label className="field">
                                    <span>{createMode === "folder" ? t(lang, "onboardingFolderName") : t(lang, "onboardingFileName")}</span>
                                    <input
                                        type="text"
                                        value={createName}
                                        onChange={(event) => setCreateName(event.target.value)}
                                        placeholder={createMode === "folder"
                                            ? t(lang, "onboardingFolderPlaceholder")
                                            : t(lang, "onboardingFilePlaceholder")}
                                        disabled={busy}
                                    />
                                </label>
                                <div className="onboarding-create-form__location">
                                    <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void handlePickLocation()}>
                                        {t(lang, "onboardingChooseLocation")}
                                    </button>
                                    {parentPath ? <p className="onboarding-create-form__path">{parentPath}</p> : null}
                                </div>
                                <div className="onboarding-create-form__actions">
                                    <button
                                        type="button"
                                        className="btn btn--ghost"
                                        disabled={busy}
                                        onClick={() => {
                                            setCreateMode(null);
                                            setError("");
                                        }}
                                    >
                                        {t(lang, "onboardingBack")}
                                    </button>
                                    <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void handleCreateAndOpen()}>
                                        {t(lang, "onboardingCreateAndOpen")}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                ) : null}

                {error ? <p className="onboarding-error">{error}</p> : null}

                <footer className="onboarding-card__footer">
                    {step !== "language" ? (
                        <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={busy}
                            onClick={() => {
                                setError("");
                                if (step === "workspace" && createMode) {
                                    setCreateMode(null);
                                    return;
                                }
                                setStep(STEPS[Math.max(0, stepIndex - 1)] ?? "language");
                            }}
                        >
                            {t(lang, "onboardingBack")}
                        </button>
                    ) : (
                        <span />
                    )}
                    {step !== "workspace" ? (
                        <button
                            type="button"
                            className="btn btn--primary"
                            disabled={busy}
                            onClick={() => {
                                setError("");
                                setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)] ?? "workspace");
                            }}
                        >
                            {t(lang, "onboardingNext")}
                        </button>
                    ) : !createMode ? (
                        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void handleSkip()}>
                            {t(lang, "onboardingSkip")}
                        </button>
                    ) : (
                        <span />
                    )}
                </footer>
            </div>
        </div>
    );
}
