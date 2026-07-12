import type { UiLanguage } from "@/types";
import { t } from "@/lib/i18n";
type UnsavedFileDialogProps = {
    open: boolean;
    filePath: string;
    lang: UiLanguage;
    loading?: boolean;
    error?: string;
    onSave: () => void;
    onDiscard: () => void;
    onCancel: () => void;
};
export function UnsavedFileDialog({ open, filePath, lang, loading = false, error = "", onSave, onDiscard, onCancel, }: UnsavedFileDialogProps) {
    if (!open)
        return null;
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    return (<div className="modal-backdrop" onClick={onCancel}>
      <div className="modal unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-dialog-title" aria-describedby="unsaved-dialog-message" onClick={(event) => event.stopPropagation()}>
        <div className="unsaved-dialog__header">
          <span className="unsaved-dialog__icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M12 18v-6"/>
              <path d="M9 15h6"/>
            </svg>
          </span>
          <div className="unsaved-dialog__headline">
            <h2 id="unsaved-dialog-title">{t(lang, "unsavedTitle")}</h2>
            <p id="unsaved-dialog-message">{t(lang, "unsavedMessage", fileName)}</p>
          </div>
        </div>

        <div className="unsaved-dialog__file">
          <span className="unsaved-dialog__file-name">{fileName}</span>
          {filePath !== fileName ? (<span className="unsaved-dialog__file-path">{filePath}</span>) : null}
        </div>

        {error ? <p className="unsaved-dialog__error">{error}</p> : null}

        <div className="unsaved-dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            {t(lang, "cancel")}
          </button>
          <button type="button" className="btn btn--ghost unsaved-dialog__btn-discard" onClick={onDiscard} disabled={loading}>
            {t(lang, "dontSave")}
          </button>
          <button type="button" className="btn btn--primary" onClick={onSave} disabled={loading}>
            {loading ? t(lang, "saving") : t(lang, "save")}
          </button>
        </div>
      </div>
    </div>);
}
