import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { CHAT_INTERACTION_MODES, modeRequiresWorkspace, type ChatInteractionMode, } from "@/lib/chat-modes";
import type { UiLanguage } from "@/types";
type ChatModeSelectorProps = {
    mode: ChatInteractionMode;
    hasWorkspace: boolean;
    lang: UiLanguage;
    disabled?: boolean;
    onChange: (mode: ChatInteractionMode) => void;
};
type MenuPosition = {
    left: number;
    bottom: number;
};
const MODE_LABEL_KEY = {
    normal: "chatModeNormal",
    agent: "chatModeAgent",
} as const satisfies Record<ChatInteractionMode, "chatModeNormal" | "chatModeAgent">;
const MODE_HINT_KEY = {
    normal: "chatModeNormalHint",
    agent: "chatModeAgentHint",
} as const satisfies Record<ChatInteractionMode, "chatModeNormalHint" | "chatModeAgentHint">;
export function ChatModeSelector({ mode, hasWorkspace, lang, disabled = false, onChange, }: ChatModeSelectorProps) {
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
        ? createPortal(<div className="model-selector__menu" role="listbox" style={{
                left: menuPos.left,
                bottom: menuPos.bottom,
            }}>
            {CHAT_INTERACTION_MODES.map((item) => {
                const needsWorkspace = modeRequiresWorkspace(item);
                const itemBlocked = needsWorkspace && !hasWorkspace;
                const isActive = mode === item;
                return (<button key={item} type="button" role="option" aria-selected={isActive} title={itemBlocked
                        ? t(lang, "chatModeNeedsWorkspace")
                        : t(lang, MODE_HINT_KEY[item])} className={`model-selector__option${isActive ? " model-selector__option--active" : ""}${itemBlocked ? " model-selector__option--warn" : ""}`} onClick={() => {
                        onChange(item);
                        setOpen(false);
                    }}>
                  <span className="model-selector__option-text">
                    {t(lang, MODE_LABEL_KEY[item])}
                  </span>
                  {itemBlocked ? (<span className="model-selector__option-hint">
                      {t(lang, "chatModeNeedsWorkspace")}
                    </span>) : null}
                </button>);
            })}
          </div>, document.body)
        : null;
    return (<div className={`model-selector${open ? " model-selector--open" : ""}`} ref={rootRef}>
      {menu}

      <button ref={triggerRef} type="button" className="model-selector__trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="model-selector__trigger-label">
          {t(lang, MODE_LABEL_KEY[mode])}
        </span>
        <svg className="model-selector__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 15l-6-6-6 6"/>
        </svg>
      </button>
    </div>);
}
