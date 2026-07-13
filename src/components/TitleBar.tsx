import { useEffect, useState } from "react";
import { APP_ICON_URL } from "@/lib/assets";
import type { FileMenuItem } from "@/lib/file-menu";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";
import { TitleBarFileMenu } from "./TitleBarFileMenu";

type TitleBarProps = {
    lang: UiLanguage;
    recentWorkspaces?: string[];
    fileMenuItems?: FileMenuItem[];
    centerTitle?: string;
    onOpenSettings: () => void;
    settingsActive?: boolean;
    minimal?: boolean;
    sidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    chatOpen?: boolean;
    terminalOpen?: boolean;
    onToggleTerminal?: () => void;
    onToggleChat?: () => void;
    onRequestClose?: () => void;
};

function SidebarToggleButton({ active, lang, onClick, mac = false }: {
    active: boolean;
    lang: UiLanguage;
    onClick: () => void;
    mac?: boolean;
}) {
    return (
        <button
            type="button"
            className={`titlebar__btn titlebar__btn--sidebar${mac ? " titlebar__btn--sidebar-mac" : ""}${active ? " titlebar__btn--active" : ""}`}
            onClick={onClick}
            aria-label={active ? t(lang, "titleSidebarHide") : t(lang, "titleSidebarShow")}
            title={active ? t(lang, "titleSidebarHide") : t(lang, "titleSidebarShow")}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2"/>
                <path d="M9 4v16"/>
            </svg>
        </button>
    );
}

export function TitleBar({
    lang,
    recentWorkspaces = [],
    fileMenuItems = [],
    centerTitle,
    onOpenSettings,
    settingsActive = false,
    minimal = false,
    sidebarOpen = true,
    onToggleSidebar,
    chatOpen = true,
    onToggleChat,
    terminalOpen = true,
    onToggleTerminal,
    onRequestClose,
}: TitleBarProps) {
    const [maximized, setMaximized] = useState(false);
    const [fullScreen, setFullScreen] = useState(false);
    const showWindowControls = window.voidscribe.hasCustomTitleBar;
    const isMac = window.voidscribe.hasMacTrafficLights;
    const showTitleBarFileMenu = fileMenuItems.length > 0 && !minimal && !isMac;
    const showMacSidebarToggle = isMac && !minimal && Boolean(onToggleSidebar);
    const showDefaultSidebarToggle = !isMac && !minimal && Boolean(onToggleSidebar);

    useEffect(() => {
        void window.voidscribe.windowIsMaximized().then(setMaximized);
        return window.voidscribe.onWindowMaximized(setMaximized);
    }, []);

    useEffect(() => {
        if (!isMac)
            return;
        void window.voidscribe.windowIsFullScreen().then(setFullScreen);
        return window.voidscribe.onWindowFullScreen(setFullScreen);
    }, [isMac]);

    const sidebarToggle = showMacSidebarToggle || showDefaultSidebarToggle
        ? <SidebarToggleButton active={sidebarOpen} lang={lang} onClick={onToggleSidebar!} mac={showMacSidebarToggle} />
        : null;

    return (
        <header className={`titlebar${isMac ? " titlebar--mac" : ""}${isMac && fullScreen ? " titlebar--mac-fullscreen" : ""}`}>
            {isMac ? (
                <div className="titlebar__mac-leading">
                    {showMacSidebarToggle ? sidebarToggle : null}
                </div>
            ) : (
                <div className="titlebar__brand">
                    <img src={APP_ICON_URL} alt="" width={22} height={22} className="titlebar__logo" draggable={false}/>
                    <span className="titlebar__name">{t(lang, "appName")}</span>
                    {showTitleBarFileMenu ? (
                        <TitleBarFileMenu lang={lang} recentWorkspaces={recentWorkspaces} items={fileMenuItems}/>
                    ) : null}
                </div>
            )}
            {isMac && centerTitle ? (
                <div className="titlebar__center" title={centerTitle}>{centerTitle}</div>
            ) : null}
            <div className="titlebar__controls">
                {showDefaultSidebarToggle ? sidebarToggle : null}
                {!minimal && onToggleTerminal ? (
                    <button type="button" className={`titlebar__btn${terminalOpen ? " titlebar__btn--active" : ""}`} onClick={onToggleTerminal} aria-label={terminalOpen ? t(lang, "titleTerminalHide") : t(lang, "titleTerminalShow")} title={t(lang, "titleTerminal")}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="3" y="4" width="18" height="14" rx="2"/>
                            <path d="M7 8h6M7 12h10"/>
                        </svg>
                    </button>
                ) : null}
                {!minimal && onToggleChat ? (
                    <button type="button" className={`titlebar__btn${chatOpen ? " titlebar__btn--active" : ""}`} onClick={onToggleChat} aria-label={t(lang, "titleChat")} title={t(lang, "titleChat")}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                    </button>
                ) : null}
                {!minimal ? (
                    <button type="button" className={`titlebar__btn titlebar__btn--settings${settingsActive ? " titlebar__btn--active" : ""}`} onClick={onOpenSettings} aria-label={t(lang, "titleSettings")} title={t(lang, "titleSettings")}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                ) : null}
                {showWindowControls ? (<>
                    <span className="titlebar__divider" aria-hidden/>
                    <button type="button" className="titlebar__btn" onClick={() => void window.voidscribe.windowMinimize()} aria-label={t(lang, "titleMinimize")} title={t(lang, "titleMinimize")}>
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6h7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
                    </button>
                    <button type="button" className="titlebar__btn" onClick={() => void window.voidscribe.windowToggleMaximize()} aria-label={maximized ? t(lang, "titleRestore") : t(lang, "titleMaximize")} title={maximized ? t(lang, "titleRestore") : t(lang, "titleMaximize")}>
                        {maximized ? (<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M4.5 2.5h5v5h-5v-5zM2.5 4.5v5h5" fill="none" stroke="currentColor" strokeWidth="1"/></svg>) : (<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1"/></svg>)}
                    </button>
                    <button type="button" className="titlebar__btn titlebar__btn--close" onMouseDown={(event) => event.stopPropagation()} onClick={() => onRequestClose?.()} aria-label={t(lang, "titleClose")} title={t(lang, "titleClose")}>
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
                    </button>
                </>) : null}
            </div>
        </header>
    );
}
