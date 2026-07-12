import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export type DropdownOption<T extends string> = {
    value: T;
    label: string;
    hint?: string;
};
type DropdownSelectProps<T extends string> = {
    id?: string;
    value: T;
    options: DropdownOption<T>[];
    onChange: (value: T) => void;
    direction?: "up" | "down";
    disabled?: boolean;
};
type MenuPosition = {
    left: number;
    top?: number;
    bottom?: number;
    width: number;
};
function ChevronIcon({ open }: {
    open: boolean;
}) {
    return (<svg className={`app-dropdown__chevron${open ? " app-dropdown__chevron--open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6"/>
    </svg>);
}
export function DropdownSelect<T extends string>({ id, value, options, onChange, direction = "down", disabled = false, }: DropdownSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = options.find((item) => item.value === value);
    useLayoutEffect(() => {
        if (!open || !triggerRef.current)
            return;
        const rect = triggerRef.current.getBoundingClientRect();
        if (direction === "up") {
            setMenuPos({
                left: rect.left,
                bottom: window.innerHeight - rect.top + 6,
                width: rect.width,
            });
            return;
        }
        setMenuPos({
            left: rect.left,
            top: rect.bottom + 6,
            width: rect.width,
        });
    }, [open, direction]);
    useEffect(() => {
        if (!open)
            return;
        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node;
            if (rootRef.current?.contains(target) ||
                (target instanceof Element && target.closest(".app-dropdown__menu"))) {
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
        ? createPortal(<div className={`app-dropdown__menu app-dropdown__menu--${direction}`} role="listbox" style={{
                left: menuPos.left,
                top: menuPos.top,
                bottom: menuPos.bottom,
                minWidth: Math.max(menuPos.width, 220),
            }}>
            {options.map((option) => {
                const isActive = option.value === value;
                return (<button key={option.value} type="button" role="option" aria-selected={isActive} className={`app-dropdown__option${isActive ? " app-dropdown__option--active" : ""}`} onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                    }}>
                  <span className="app-dropdown__option-label">{option.label}</span>
                  {option.hint ? <span className="app-dropdown__option-hint">{option.hint}</span> : null}
                </button>);
            })}
          </div>, document.body)
        : null;
    return (<div className={`app-dropdown${open ? " app-dropdown--open" : ""}`} ref={rootRef}>
      {menu}
      <button ref={triggerRef} id={id} type="button" className="app-dropdown__trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)}>
        <span className="app-dropdown__value">{selected?.label ?? value}</span>
        <ChevronIcon open={open}/>
      </button>
    </div>);
}
