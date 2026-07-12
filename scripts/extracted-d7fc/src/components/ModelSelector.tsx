import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPresetLabel } from "@/lib/model-presets";
import type { SettingsPublic } from "@/types";

type ModelSelectorProps = {
  settings: SettingsPublic;
  disabled?: boolean;
  onSelectPreset: (presetId: string) => void;
  onOpenSettings: () => void;
};

type MenuPosition = {
  left: number;
  bottom: number;
};

export function ModelSelector({
  settings,
  disabled = false,
  onSelectPreset,
  onOpenSettings,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const readyPresets = settings.presets.filter((item) => item.hasApiKey);
  const hasAnyApiKey = readyPresets.length > 0;
  const canOpenMenu = readyPresets.length > 1;

  const displayPreset =
    readyPresets.find((item) => item.id === settings.activePresetId) ??
    readyPresets[0];

  const triggerLabel = !hasAnyApiKey
    ? "Добавьте ключ в настройках"
    : displayPreset
      ? getPresetLabel(displayPreset)
      : "Добавьте ключ в настройках";

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 6,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        (target instanceof Element && target.closest(".model-selector__menu"))
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleTriggerClick() {
    if (!hasAnyApiKey) {
      onOpenSettings();
      return;
    }

    if (canOpenMenu) {
      setOpen((value) => !value);
    }
  }

  const menu =
    open && canOpenMenu && menuPos
      ? createPortal(
          <div
            className="model-selector__menu"
            role="listbox"
            style={{
              left: menuPos.left,
              bottom: menuPos.bottom,
            }}
          >
            {readyPresets.map((preset) => {
              const isActive = preset.id === settings.activePresetId;

              return (
                <button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`model-selector__option${isActive ? " model-selector__option--active" : ""}`}
                  onClick={() => {
                    onSelectPreset(preset.id);
                    setOpen(false);
                  }}
                >
                  <span className="model-selector__option-text">
                    {getPresetLabel(preset)}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={`model-selector${open ? " model-selector--open" : ""}`}
      ref={rootRef}
    >
      {menu}

      <button
        ref={triggerRef}
        type="button"
        className="model-selector__trigger"
        disabled={disabled}
        aria-haspopup={canOpenMenu ? "listbox" : undefined}
        aria-expanded={canOpenMenu ? open : undefined}
        onClick={handleTriggerClick}
      >
        <span
          className={`model-selector__trigger-label${!hasAnyApiKey ? " model-selector__trigger-label--muted" : ""}`}
        >
          {triggerLabel}
        </span>
        {canOpenMenu ? (
          <svg
            className="model-selector__chevron"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        ) : null}
      </button>
    </div>
  );
}
