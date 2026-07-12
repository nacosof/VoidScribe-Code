import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

export type EditorContextMenuState = {
    x: number;
    y: number;
    canCopy: boolean;
};

type EditorContextMenuProps = {
    menu: EditorContextMenuState;
    lang: UiLanguage;
    onCopy: () => void;
    onPaste: () => void;
    onClose: () => void;
};

export function EditorContextMenu({ menu, lang, onCopy, onPaste, onClose }: EditorContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            if (menuRef.current?.contains(event.target as Node))
                return;
            onClose();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                onClose();
        };
        window.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="code-editor__context-menu"
            style={{ left: menu.x, top: menu.y }}
            role="menu"
            onContextMenu={(event) => event.preventDefault()}
        >
            <button
                type="button"
                className="code-editor__context-menu-item"
                role="menuitem"
                disabled={!menu.canCopy}
                onClick={() => {
                    onCopy();
                    onClose();
                }}
            >
                {t(lang, "copy")}
            </button>
            <button
                type="button"
                className="code-editor__context-menu-item"
                role="menuitem"
                onClick={() => {
                    void onPaste();
                    onClose();
                }}
            >
                {t(lang, "paste")}
            </button>
        </div>
    );
}
