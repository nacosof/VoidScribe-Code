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

export function AgentChangesBar({
  changes,
  lang,
  onUndoAll,
  onKeepAll,
  onUndoOne,
  onKeepOne,
  onOpenFile,
}: AgentChangesBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (changes.length === 0) return null;

  return (
    <div className="agent-changes">
      <div className="agent-changes__head">
        <button
          type="button"
          className="agent-changes__toggle"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          <svg
            className={`agent-changes__chevron${expanded ? " agent-changes__chevron--open" : ""}`}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span>{t(lang, "filesCount", changes.length)}</span>
        </button>

        <div className="agent-changes__actions">
          <button
            type="button"
            className="agent-changes__btn"
            onClick={onUndoAll}
          >
            {t(lang, "undoAll")}
          </button>
          <button
            type="button"
            className="agent-changes__btn"
            onClick={onKeepAll}
          >
            {t(lang, "keepAll")}
          </button>
        </div>
      </div>

      {expanded ? (
        <ul className="agent-changes__list">
          {changes.map((change) => (
            <li key={change.id} className="agent-changes__item">
              {onOpenFile ? (
                <button
                  type="button"
                  className="agent-changes__file-path-btn"
                  onClick={() => onOpenFile(change.path)}
                  title={change.path}
                >
                  <span className="agent-changes__file-path">{change.path}</span>
                  <span className="agent-changes__file-kind">
                    {change.kind === "created"
                      ? t(lang, "created")
                      : t(lang, "modified")}
                  </span>
                </button>
              ) : (
                <div className="agent-changes__file-path-btn agent-changes__file-path-btn--static">
                  <span className="agent-changes__file-path">{change.path}</span>
                  <span className="agent-changes__file-kind">
                    {change.kind === "created"
                      ? t(lang, "created")
                      : t(lang, "modified")}
                  </span>
                </div>
              )}
              <div className="agent-changes__item-actions">
                <button
                  type="button"
                  className="agent-changes__btn agent-changes__btn--small"
                  onClick={() => onUndoOne(change.id)}
                >
                  {t(lang, "undoOne")}
                </button>
                <button
                  type="button"
                  className="agent-changes__btn agent-changes__btn--small agent-changes__btn--primary"
                  onClick={() => onKeepOne(change.id)}
                >
                  {t(lang, "keepOne")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
