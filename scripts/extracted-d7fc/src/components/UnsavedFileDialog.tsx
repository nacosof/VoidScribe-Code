import type { UiLanguage } from "@/types";
import { t } from "@/lib/i18n";

type UnsavedFileDialogProps = {
  open: boolean;
  filePath: string;
  lang: UiLanguage;
  loading?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedFileDialog({
  open,
  filePath,
  lang,
  loading = false,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedFileDialogProps) {
  if (!open) return null;

  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal modal--compact"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        aria-describedby="unsaved-dialog-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="unsaved-dialog-title">{t(lang, "unsavedTitle")}</h2>
        <p id="unsaved-dialog-message">
          {t(lang, "unsavedMessage", fileName)}
        </p>
        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {t(lang, "cancel")}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onDiscard}
            disabled={loading}
          >
            {t(lang, "dontSave")}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onSave}
            disabled={loading}
          >
            {loading ? t(lang, "saving") : t(lang, "save")}
          </button>
        </div>
      </div>
    </div>
  );
}
