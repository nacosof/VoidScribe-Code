import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type AssistantSetupPromptProps = {
  open: boolean;
  lang: UiLanguage;
  onClose: () => void;
  onOpenSettings: () => void;
};

export function AssistantSetupPrompt({
  open,
  lang,
  onClose,
  onOpenSettings,
}: AssistantSetupPromptProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--compact"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{t(lang, "setupTitle")}</h2>
        <p>{t(lang, "setupDesc")}</p>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t(lang, "setupClose")}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            {t(lang, "setupOpenSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}
