import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type EditorQuickEditPanelProps = {
    lang: UiLanguage;
    top: number;
    left: number;
    loading: boolean;
    value: string;
    error?: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
};

export function EditorQuickEditPanel({
    lang,
    top,
    left,
    loading,
    value,
    error,
    onChange,
    onSubmit,
    onCancel,
}: EditorQuickEditPanelProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        inputRef.current?.focus();
        const id = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => window.clearTimeout(id);
    }, []);
    return (
        <div
            className="editor-quick-edit"
            style={{ top, left }}
            onMouseDown={(event) => event.preventDefault()}
        >
            <form
                className="editor-quick-edit__form"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!loading && value.trim())
                        onSubmit();
                }}
            >
                <input
                    ref={inputRef}
                    className="editor-quick-edit__input"
                    value={value}
                    disabled={loading}
                    placeholder={t(lang, "editorQuickEditPlaceholder")}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            event.preventDefault();
                            onCancel();
                        }
                    }}
                />
                <div className="editor-quick-edit__actions">
                    <button type="button" className="btn btn--ghost editor-quick-edit__btn" disabled={loading} onClick={onCancel}>
                        {t(lang, "cancel")}
                    </button>
                    <button type="submit" className="btn btn--primary editor-quick-edit__btn" disabled={loading || !value.trim()}>
                        {loading ? t(lang, "editorQuickEditWorking") : t(lang, "editorQuickEditApply")}
                    </button>
                </div>
            </form>
            {error ? <p className="editor-quick-edit__error">{error}</p> : null}
        </div>
    );
}
