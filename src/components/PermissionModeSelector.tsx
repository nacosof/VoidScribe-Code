import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { AGENT_PERMISSION_MODES, type AgentPermissionMode } from "@/lib/agent-permission";
import type { UiLanguage } from "@/types";

type PermissionModeSelectorProps = {
    mode: AgentPermissionMode;
    lang: UiLanguage;
    disabled?: boolean;
    onChange: (mode: AgentPermissionMode) => void;
};

type MenuPosition = {
    left: number;
    bottom: number;
};

const LABEL_KEY = {
    read: "permissionModeRead",
    ask: "permissionModeAsk",
    full: "permissionModeFull",
} as const satisfies Record<AgentPermissionMode, "permissionModeRead" | "permissionModeAsk" | "permissionModeFull">;

const HINT_KEY = {
    read: "permissionModeReadHint",
    ask: "permissionModeAskHint",
    full: "permissionModeFullHint",
} as const satisfies Record<AgentPermissionMode, "permissionModeReadHint" | "permissionModeAskHint" | "permissionModeFullHint">;

function ShieldReadIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/>
            <path d="M9 12l2 2 4-4"/>
        </svg>
    );
}

function ShieldWriteIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/>
            <path d="M9 10h6M9 13h6M9 16h4"/>
        </svg>
    );
}

function ShieldFullIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/>
            <circle cx="12" cy="11" r="1.2" fill="currentColor" stroke="none"/>
            <path d="M12 13.5v3"/>
        </svg>
    );
}

const MODE_ICON: Record<AgentPermissionMode, ReactNode> = {
    read: <ShieldReadIcon />,
    ask: <ShieldWriteIcon />,
    full: <ShieldFullIcon />,
};

export function PermissionModeSelector({ mode, lang, disabled = false, onChange }: PermissionModeSelectorProps) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current)
            return;
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuPos({
            left: rect.left,
            bottom: window.innerHeight - rect.top + 6,
        });
    }, [open]);

    useEffect(() => {
        if (!open)
            return;
        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node;
            if (rootRef.current?.contains(target) ||
                (target instanceof Element && target.closest(".model-selector__menu"))) {
                return;
            }
            setOpen(false);
        }
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape")
                setOpen(false);
        }
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const menu = open && menuPos
        ? createPortal(
            <div
                className="model-selector__menu permission-mode-menu"
                role="listbox"
                style={{ left: menuPos.left, bottom: menuPos.bottom }}
            >
                {AGENT_PERMISSION_MODES.map((item) => {
                    const isActive = mode === item;
                    return (
                        <button
                            key={item}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            title={t(lang, HINT_KEY[item])}
                            className={`model-selector__option permission-mode-menu__option${isActive ? " model-selector__option--active" : ""}`}
                            onClick={() => {
                                onChange(item);
                                setOpen(false);
                            }}
                        >
                            <span className="permission-mode-menu__icon">{MODE_ICON[item]}</span>
                            <span className="model-selector__option-text">
                                {t(lang, LABEL_KEY[item])}
                            </span>
                            {isActive ? (
                                <span className="permission-mode-menu__check" aria-hidden>✓</span>
                            ) : null}
                        </button>
                    );
                })}
            </div>,
            document.body,
        )
        : null;

    return (
        <div className={`model-selector${open ? " model-selector--open" : ""}`} ref={rootRef}>
            {menu}
            <button
                ref={triggerRef}
                type="button"
                className="model-selector__trigger permission-mode-trigger"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                <span className="permission-mode-trigger__icon">{MODE_ICON[mode]}</span>
                <span className="model-selector__trigger-label">
                    {t(lang, LABEL_KEY[mode])}
                </span>
                <svg className="model-selector__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 15l-6-6-6 6"/>
                </svg>
            </button>
        </div>
    );
}
