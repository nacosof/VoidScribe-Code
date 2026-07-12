import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type EditorSelectionToolbarProps = {
    lang: UiLanguage;
    top: number;
    left: number;
    onAddToChat: () => void;
    onQuickEdit: () => void;
};

function shortcutLabel(key: string): string {
    const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
    if (key === "Mod-l")
        return isMac ? "⌘L" : "Ctrl+L";
    if (key === "Mod-k")
        return isMac ? "⌘K" : "Ctrl+K";
    return key;
}

export function EditorSelectionToolbar({ lang, top, left, onAddToChat, onQuickEdit }: EditorSelectionToolbarProps) {
    return (
        <div
            className="editor-selection-toolbar"
            style={{ top, left }}
            role="toolbar"
            aria-label={t(lang, "editorSelectionToolbar")}
            onMouseDown={(event) => event.preventDefault()}
        >
            <button type="button" className="editor-selection-toolbar__btn" onClick={onAddToChat}>
                <span>{t(lang, "editorAddToChat")}</span>
                <kbd>{shortcutLabel("Mod-l")}</kbd>
            </button>
            <button type="button" className="editor-selection-toolbar__btn" onClick={onQuickEdit}>
                <span>{t(lang, "editorQuickEdit")}</span>
                <kbd>{shortcutLabel("Mod-k")}</kbd>
            </button>
        </div>
    );
}
