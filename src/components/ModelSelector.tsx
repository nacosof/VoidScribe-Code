import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPresetLabel, getReadyPresets } from "@/lib/agent-presets";
import { t } from "@/lib/i18n";
import type { AiSettings, UiLanguage } from "@/types";
type ModelSelectorProps = {
    settings: AiSettings;
    lang: UiLanguage;
    disabled?: boolean;
    onSelectPreset: (presetId: string) => void;
    onOpenSettings: () => void;
};
type MenuPosition = {
    left: number;
    bottom: number;
};
export function ModelSelector({ settings, lang, disabled = false, onSelectPreset, onOpenSettings, }: ModelSelectorProps) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const readyPresets = getReadyPresets(settings);
    const hasAnyAgent = readyPresets.length > 0;
    const canOpenMenu = readyPresets.length > 0;
    const displayPreset = readyPresets.find((item) => item.id === settings.activePresetId) ?? readyPresets[0];
    const triggerLabel = !hasAnyAgent
        ? t(lang, "addKeyInSettings")
        : displayPreset
            ? getPresetLabel(displayPreset)
            : t(lang, "addKeyInSettings");
    useLayoutEffect(() => {
        if (!open || !triggerRef.current)
            return;
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuPos({ left: rect.left, bottom: window.innerHeight - rect.top + 6 });
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
    function handleTriggerClick() {
        if (!hasAnyAgent) {
            onOpenSettings();
            return;
        }
        if (readyPresets.length === 1) {
            onSelectPreset(readyPresets[0]!.id);
            return;
        }
        setOpen((value) => !value);
    }
    const menu = open && canOpenMenu && readyPresets.length > 1 && menuPos
        ? createPortal(<div className="model-selector__menu" role="listbox" style={{ left: menuPos.left, bottom: menuPos.bottom }}>
            {readyPresets.map((preset) => {
                const isActive = preset.id === settings.activePresetId;
                return (<button key={preset.id} type="button" role="option" aria-selected={isActive} className={`model-selector__option${isActive ? " model-selector__option--active" : ""}`} onClick={() => {
                        onSelectPreset(preset.id);
                        setOpen(false);
                    }}>
                  <span className="model-selector__option-text">{getPresetLabel(preset)}</span>
                  <span className="model-selector__option-hint">{preset.model}</span>
                </button>);
            })}
          </div>, document.body)
        : null;
    return (<div className={`model-selector${open ? " model-selector--open" : ""}`} ref={rootRef}>
      {menu}
      <button ref={triggerRef} type="button" className="model-selector__trigger" disabled={disabled} aria-haspopup={canOpenMenu && readyPresets.length > 1 ? "listbox" : undefined} aria-expanded={canOpenMenu && readyPresets.length > 1 ? open : undefined} onClick={handleTriggerClick}>
        <span className={`model-selector__trigger-label${!hasAnyAgent ? " model-selector__trigger-label--muted" : ""}`}>
          {triggerLabel}
        </span>
        {readyPresets.length > 1 ? (<svg className="model-selector__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 15l-6-6-6 6"/>
          </svg>) : null}
      </button>
    </div>);
}
