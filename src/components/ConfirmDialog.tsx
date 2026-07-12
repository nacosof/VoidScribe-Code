type ConfirmDialogProps = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    loading?: boolean;
    loadingLabel?: string;
    dontAskAgainLabel?: string;
    dontAskAgain?: boolean;
    onDontAskAgainChange?: (checked: boolean) => void;
    onConfirm: () => void;
    onCancel: () => void;
};
export function ConfirmDialog({ open, title, message, confirmLabel = "Подтвердить", cancelLabel = "Отмена", danger = false, loading = false, loadingLabel = "…", dontAskAgainLabel, dontAskAgain = false, onDontAskAgainChange, onConfirm, onCancel, }: ConfirmDialogProps) {
    if (!open)
        return null;
    return (<div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--compact" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
        {dontAskAgainLabel && onDontAskAgainChange ? (<label className="modal__checkbox">
            <input type="checkbox" checked={dontAskAgain} onChange={(event) => onDontAskAgainChange(event.target.checked)}/>
            <span>{dontAskAgainLabel}</span>
          </label>) : null}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? "btn--danger" : "btn--primary"}`} onClick={onConfirm} disabled={loading}>
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>);
}
