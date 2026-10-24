import { useEffect, useRef, useState } from "react";
import type { ChatSession, UiLanguage } from "@/types";
import { t } from "@/lib/i18n";

type ChatSessionsSidebarProps = {
    sessions: ChatSession[];
    activeId: string;
    canClear: boolean;
    lang: UiLanguage;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    onCreate: () => void;
    onClear: () => void;
};

function formatRelativeAge(updatedAt: number, lang: UiLanguage): string {
    const deltaMs = Math.max(0, Date.now() - updatedAt);
    const minutes = Math.floor(deltaMs / 60000);
    if (minutes < 1)
        return lang === "ru" ? "сейчас" : "now";
    if (minutes < 60)
        return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48)
        return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

function ChatBubbleIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
    );
}

export function ChatSessionsSidebar({
    sessions,
    activeId,
    canClear,
    lang,
    onSelect,
    onClose,
    onCreate,
    onClear,
}: ChatSessionsSidebarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen)
            return;
        function close(event: MouseEvent) {
            if (menuRef.current?.contains(event.target as Node))
                return;
            setMenuOpen(false);
        }
        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
    }, [menuOpen]);

    return (
        <div className="chat-sessions-sidebar">
            <div className="chat-sessions-sidebar__header">
                <h2 className="chat-sessions-sidebar__title">{t(lang, "chatSessions")}</h2>
                <div className="chat-sessions-sidebar__header-actions" ref={menuRef}>
                    <button
                        type="button"
                        className="chat-sessions-sidebar__icon-btn"
                        onClick={onCreate}
                        aria-label={t(lang, "newChat")}
                        title={t(lang, "newChat")}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                    </button>
                    <button
                        type="button"
                        className={`chat-sessions-sidebar__icon-btn${menuOpen ? " chat-sessions-sidebar__icon-btn--open" : ""}`}
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={t(lang, "chatMenu")}
                        aria-expanded={menuOpen}
                        title={t(lang, "chatMenu")}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <circle cx="5" cy="12" r="1.6"/>
                            <circle cx="12" cy="12" r="1.6"/>
                            <circle cx="19" cy="12" r="1.6"/>
                        </svg>
                    </button>
                    {menuOpen ? (
                        <div className="chat-sessions-sidebar__menu" role="menu">
                            <button
                                type="button"
                                className="chat-sessions-sidebar__menu-item"
                                role="menuitem"
                                disabled={!canClear}
                                onClick={() => {
                                    setMenuOpen(false);
                                    onClear();
                                }}
                            >
                                {t(lang, "clearChat")}
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="chat-sessions-sidebar__list overlay-scrollbar">
                {sessions.map((session) => {
                    const isActive = session.id === activeId;
                    return (
                        <div
                            key={session.id}
                            className={`chat-sessions-sidebar__item${isActive ? " chat-sessions-sidebar__item--active" : ""}`}
                        >
                            <button
                                type="button"
                                className="chat-sessions-sidebar__item-main"
                                onClick={() => onSelect(session.id)}
                                title={session.title}
                            >
                                <span className="chat-sessions-sidebar__item-icon">
                                    <ChatBubbleIcon />
                                </span>
                                <span className="chat-sessions-sidebar__item-text">
                                    <span className="chat-sessions-sidebar__item-title">{session.title}</span>
                                    <span className="chat-sessions-sidebar__item-age">
                                        {formatRelativeAge(session.updatedAt, lang)}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                className="chat-sessions-sidebar__item-close"
                                onClick={() => onClose(session.id)}
                                aria-label={t(lang, "closeTab", session.title)}
                                title={t(lang, "close")}
                            >
                                ×
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
