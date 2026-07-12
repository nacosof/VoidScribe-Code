import { useEffect, useRef, useState } from "react";
import type { ChatSession } from "@/lib/chat-sessions";
import { handleHorizontalWheel } from "@/lib/horizontal-scroll";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type ChatTabsBarProps = {
  sessions: ChatSession[];
  activeId: string;
  isStreaming: boolean;
  canClear: boolean;
  lang: UiLanguage;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
  onClear: () => void;
};

function ChatTabIcon() {
  return (
    <svg
      className="chat-tab__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChatMenuIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

export function ChatTabsBar({
  sessions,
  activeId,
  isStreaming,
  canClear,
  lang,
  onSelect,
  onClose,
  onCreate,
  onClear,
}: ChatTabsBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  function handleClear() {
    setMenuOpen(false);
    onClear();
  }

  return (
    <div className="chat-tabs">
      <div className="chat-tabs__list" onWheel={handleHorizontalWheel}>
        {sessions.map((session) => {
          const isActive = session.id === activeId;
          const canClose =
            sessions.length > 1 && !(isStreaming && isActive);

          return (
            <div
              key={session.id}
              className={`chat-tab${isActive ? " chat-tab--active" : ""}`}
            >
              <button
                type="button"
                className="chat-tab__label"
                onClick={() => onSelect(session.id)}
                title={session.title}
              >
                <ChatTabIcon />
                <span className="chat-tab__title">{session.title}</span>
              </button>
              {canClose ? (
                <button
                  type="button"
                  className="chat-tab__close"
                  onClick={() => onClose(session.id)}
                  aria-label={t(lang, "closeTab", session.title)}
                  title={t(lang, "close")}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="chat-tabs__actions" ref={menuRef}>
        <button
          type="button"
          className="chat-tabs__new"
          onClick={onCreate}
          aria-label={t(lang, "newChat")}
          title={t(lang, "newChat")}
        >
          +
        </button>

        <div className="chat-tabs__menu-wrap">
          <button
            type="button"
            className={`chat-tabs__menu-btn${menuOpen ? " chat-tabs__menu-btn--open" : ""}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t(lang, "chatMenu")}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={t(lang, "chatMenu")}
          >
            <ChatMenuIcon />
          </button>

          {menuOpen ? (
            <div className="chat-tabs__menu" role="menu">
              <button
                type="button"
                className="chat-tabs__menu-item"
                role="menuitem"
                disabled={!canClear}
                onClick={handleClear}
              >
                {t(lang, "clearChat")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
