import { useEffect, useState } from "react";
import { APP_ICON_URL } from "@/lib/assets";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type TitleBarProps = {
  lang: UiLanguage;
  onOpenSettings: () => void;
  settingsActive?: boolean;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  terminalOpen?: boolean;
  onToggleTerminal?: () => void;
  agentPanelOpen?: boolean;
  onToggleAgentPanel?: () => void;
  agentPanelLabel?: string;
  onRequestClose?: () => void;
};

export function TitleBar({
  lang,
  onOpenSettings,
  settingsActive = false,
  sidebarOpen = true,
  onToggleSidebar,
  terminalOpen = false,
  onToggleTerminal,
  agentPanelOpen = true,
  onToggleAgentPanel,
  agentPanelLabel,
  onRequestClose,
}: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const chatLabel = agentPanelLabel ?? t(lang, "titleChat");

  useEffect(() => {
    void window.voidscribe.windowIsMaximized().then(setMaximized);
    return window.voidscribe.onWindowMaximized(setMaximized);
  }, []);

  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <img
          src={APP_ICON_URL}
          alt=""
          width={22}
          height={22}
          className="titlebar__logo"
          draggable={false}
        />
        <span className="titlebar__name">VoidScribe Code</span>
      </div>

      <div className="titlebar__controls">
        {onToggleSidebar ? (
          <button
            type="button"
            className={`titlebar__btn${sidebarOpen ? " titlebar__btn--active" : ""}`}
            onClick={onToggleSidebar}
            aria-label={
              sidebarOpen
                ? t(lang, "titleSidebarHide")
                : t(lang, "titleSidebarShow")
            }
            title={
              sidebarOpen
                ? t(lang, "titleSidebarHide")
                : t(lang, "titleSidebarShow")
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
        ) : null}

        {onToggleTerminal ? (
          <button
            type="button"
            className={`titlebar__btn${terminalOpen ? " titlebar__btn--active" : ""}`}
            onClick={onToggleTerminal}
            aria-label={
              terminalOpen
                ? t(lang, "titleTerminalHide")
                : t(lang, "titleTerminalShow")
            }
            title={t(lang, "titleTerminal")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <path d="M7 8h6M7 12h10" />
            </svg>
          </button>
        ) : null}

        {onToggleAgentPanel ? (
          <button
            type="button"
            className={`titlebar__btn${agentPanelOpen ? " titlebar__btn--active" : ""}`}
            onClick={onToggleAgentPanel}
            aria-label={chatLabel}
            title={chatLabel}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        ) : null}

        <button
          type="button"
          className={`titlebar__btn titlebar__btn--settings${settingsActive ? " titlebar__btn--active" : ""}`}
          onClick={onOpenSettings}
          aria-label={t(lang, "titleSettings")}
          title={t(lang, "titleSettings")}
        >
          <svg
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
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <span className="titlebar__divider" aria-hidden />

        <button
          type="button"
          className="titlebar__btn"
          onClick={() => void window.voidscribe.windowMinimize()}
          aria-label={t(lang, "titleMinimize")}
          title={t(lang, "titleMinimize")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M2.5 6h7"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar__btn"
          onClick={() => void window.voidscribe.windowToggleMaximize()}
          aria-label={maximized ? t(lang, "titleRestore") : t(lang, "titleMaximize")}
          title={maximized ? t(lang, "titleRestore") : t(lang, "titleMaximize")}
        >
          {maximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M4.5 2.5h5v5h-5v-5zM2.5 4.5v5h5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <rect
                x="2.5"
                y="2.5"
                width="7"
                height="7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="titlebar__btn titlebar__btn--close"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onRequestClose?.()}
          aria-label={t(lang, "titleClose")}
          title={t(lang, "titleClose")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M3 3l6 6M9 3L3 9"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
