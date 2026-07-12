import { useState } from "react";
import type { ChatContextRef, UiLanguage } from "@/types";
import { CHAT_ENTRY_DRAG_MIME, readDraggedChatEntry } from "@/lib/chat-context";
import { t } from "@/lib/i18n";

type ComposerContextChipsProps = {
  refs: ChatContextRef[];
  lang: UiLanguage;
  disabled?: boolean;
  onChange: (refs: ChatContextRef[]) => void;
};

function ContextChipIcon({ kind }: { kind: ChatContextRef["kind"] }) {
  if (kind === "directory") {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      </svg>
    );
  }

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 6h8M8 10h8M8 14h5" />
      <rect x="5" y="4" width="14" height="16" rx="2" />
    </svg>
  );
}

export function ComposerContextChips({
  refs,
  lang,
  disabled = false,
  onChange,
}: ComposerContextChipsProps) {
  const [dragOver, setDragOver] = useState(false);

  function addRef(entry: ChatContextRef) {
    if (disabled) return;
    if (refs.some((item) => item.path === entry.path)) return;
    onChange([...refs, entry]);
  }

  function handleDragOver(event: React.DragEvent) {
    if (disabled) return;
    if (!event.dataTransfer.types.includes(CHAT_ENTRY_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const entry = readDraggedChatEntry(event.dataTransfer);
    if (entry) addRef(entry);
  }

  return (
    <div
      className={`composer-context${dragOver ? " composer-context--drag-over" : ""}${refs.length ? " composer-context--has-refs" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {refs.map((ref) => (
        <span key={ref.path} className="composer-context__chip" title={ref.path}>
          <span className="composer-context__chip-icon">
            <ContextChipIcon kind={ref.kind} />
          </span>
          <span className="composer-context__chip-label">{ref.name}</span>
          {!disabled ? (
            <button
              type="button"
              className="composer-context__chip-remove"
              onClick={() => onChange(refs.filter((item) => item.path !== ref.path))}
              aria-label={t(lang, "removeContextRef", ref.name)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function ChatContextChips({
  refs,
  lang,
}: {
  refs: ChatContextRef[];
  lang: UiLanguage;
}) {
  if (!refs.length) return null;

  return (
    <div className="chat-context-chips">
      {refs.map((ref) => (
        <span key={ref.path} className="composer-context__chip" title={ref.path}>
          <span className="composer-context__chip-icon">
            <ContextChipIcon kind={ref.kind} />
          </span>
          <span className="composer-context__chip-label">{ref.name}</span>
        </span>
      ))}
    </div>
  );
}
