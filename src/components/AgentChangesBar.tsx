import { useState } from "react";
import type { PendingFileChange, UiLanguage } from "@/types";
import { t } from "@/lib/i18n";
type AgentChangesBarProps = {
    changes: PendingFileChange[];
    lang: UiLanguage;
    onUndoAll: () => void;
    onKeepAll: () => void;
    onUndoOne: (id: string) => void;
    onKeepOne: (id: string) => void;
    onOpenFile?: (path: string) => void;
};
export function AgentChangesBar({ changes, lang, onUndoAll, onKeepAll, onUndoOne, onKeepOne, onOpenFile, }: AgentChangesBarProps) {
    const [expanded, setExpanded] = useState(false);
    if (changes.length === 0)
        return null;
    const preview = changes[0]?.path ?? "";
    return (<div className="agent-changes">
      <div className="agent-changes__head">
        <button type="button" className="agent-changes__toggle" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded}>
          <svg className={`agent-changes__chevron${expanded ? " agent-changes__chevron--open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6"/>
          </svg>
          <span>{t(lang, "filesCount", changes.length)}</span>
          {!expanded && preview && onOpenFile ? (<button type="button" className="agent-changes__preview" title={preview} onClick={(event) => {
                event.stopPropagation();
                onOpenFile(preview);
            }}>
              {preview}
            </button>) : !expanded && preview ? (<span className="agent-changes__preview" title={preview}>
              {preview}
            </span>) : null}
        </button>

        <div className="agent-changes__actions">
          <button type="button" className="agent-changes__btn" onClick={onUndoAll}>
            {t(lang, "undoAll")}
          </button>
          <button type="button" className="agent-changes__btn agent-changes__btn--primary" onClick={onKeepAll}>
            {t(lang, "keepAll")}
          </button>
        </div>
      </div>

      {expanded ? (<ul className="agent-changes__list">
          {changes.map((change) => (<li key={change.id} className="agent-changes__item">
              {onOpenFile ? (<button type="button" className="agent-changes__file-path-btn" onClick={() => onOpenFile(change.path)} title={change.path}>
                  <span className="agent-changes__file-path">{change.path}</span>
                  <span className="agent-changes__file-kind">
                    {change.kind === "created"
                        ? t(lang, "created")
                        : change.kind === "deleted"
                            ? t(lang, "deleted")
                            : t(lang, "modified")}
                  </span>
                </button>) : (<div className="agent-changes__file-path-btn agent-changes__file-path-btn--static">
                  <span className="agent-changes__file-path">{change.path}</span>
                  <span className="agent-changes__file-kind">
                    {change.kind === "created"
                        ? t(lang, "created")
                        : change.kind === "deleted"
                            ? t(lang, "deleted")
                            : t(lang, "modified")}
                  </span>
                </div>)}
              <div className="agent-changes__item-actions">
                <button type="button" className="agent-changes__icon-btn" onClick={() => onUndoOne(change.id)} title={t(lang, "undoOne")} aria-label={t(lang, "undoOne")}>
                  ×
                </button>
                <button type="button" className="agent-changes__icon-btn agent-changes__icon-btn--accept" onClick={() => onKeepOne(change.id)} title={t(lang, "keepOne")} aria-label={t(lang, "keepOne")}>
                  ✓
                </button>
              </div>
            </li>))}
        </ul>) : null}
    </div>);
}
