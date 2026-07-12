import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

export type TerminalContextMenuState = {
    x: number;
    y: number;
    canCopy: boolean;
};

type TerminalContextMenuProps = {
    menu: TerminalContextMenuState;
    lang: UiLanguage;
    canPaste: boolean;
    onCopy: () => void;
    onPaste: () => void;
    onClose: () => void;
};

export function TerminalContextMenu({
    menu,
    lang,
    canPaste,
    onCopy,
    onPaste,
    onClose,
}: TerminalContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            if (menuRef.current?.contains(event.target as Node))
                return;
            onClose();
        };
        window.addEventListener("pointerdown", onPointerDown);
        return () => window.removeEventListener("pointerdown", onPointerDown);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="terminal-panel__context-menu"
            style={{ left: menu.x, top: menu.y }}
            role="menu"
            onContextMenu={(event) => event.preventDefault()}
        >
            <button
                type="button"
                className="terminal-panel__context-menu-item"
                role="menuitem"
                disabled={!menu.canCopy}
                onClick={() => {
                    onCopy();
                    onClose();
                }}
            >
                {t(lang, "copy")}
            </button>
            {canPaste ? (
                <button
                    type="button"
                    className="terminal-panel__context-menu-item"
                    role="menuitem"
                    onClick={() => {
                        void onPaste();
                        onClose();
                    }}
                >
                    {t(lang, "paste")}
                </button>
            ) : null}
        </div>
    );
}
