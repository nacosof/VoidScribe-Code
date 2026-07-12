import { useEffect, useRef, useState } from "react";
import type { FileMenuItem } from "@/lib/file-menu";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";
type TitleBarFileMenuProps = {
    lang: UiLanguage;
    recentWorkspaces: string[];
    items: FileMenuItem[];
};
export function TitleBarFileMenu({ lang, recentWorkspaces, items }: TitleBarFileMenuProps) {
    const [open, setOpen] = useState(false);
    const [submenuId, setSubmenuId] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        function onPointerDown(event: MouseEvent) {
            const target = event.target;
            if (!(target instanceof Node))
                return;
            if (!rootRef.current?.contains(target)) {
                setOpen(false);
                setSubmenuId(null);
            }
        }
        window.addEventListener("mousedown", onPointerDown);
        return () => window.removeEventListener("mousedown", onPointerDown);
    }, [open]);
    function runItem(item: FileMenuItem) {
        if (item.disabled || item.separator)
            return;
        if (item.submenu?.length)
            return;
        setOpen(false);
        setSubmenuId(null);
        item.onClick?.();
    }
    function renderItems(list: FileMenuItem[], nested = false) {
        return list.map((item) => {
            if (item.separator) {
                return <div key={item.id} className="titlebar-file-menu__sep"/>;
            }
            const hasSubmenu = Boolean(item.submenu?.length || item.id === "open-recent");
            const submenuOpen = submenuId === item.id;
            return (<div key={item.id} className={`titlebar-file-menu__row-wrap${submenuOpen ? " titlebar-file-menu__row-wrap--open" : ""}`} onMouseEnter={() => {
                    if (hasSubmenu)
                        setSubmenuId(item.id);
                }}>
          <button type="button" className={`titlebar-file-menu__item${item.disabled ? " titlebar-file-menu__item--disabled" : ""}${item.checked ? " titlebar-file-menu__item--checked" : ""}`} disabled={item.disabled} onClick={() => runItem(item)}>
            <span className="titlebar-file-menu__label">
              {item.labelKey ? t(lang, item.labelKey) : item.label}
            </span>
            {item.shortcut ? (<span className="titlebar-file-menu__shortcut">{item.shortcut}</span>) : hasSubmenu ? (<span className="titlebar-file-menu__arrow" aria-hidden>
                ›
              </span>) : null}
          </button>

          {hasSubmenu && submenuOpen ? (<div className={`titlebar-file-menu__submenu${nested ? " titlebar-file-menu__submenu--nested" : ""}`}>
              {item.id === "open-recent" && recentWorkspaces.length === 0 ? (<div className="titlebar-file-menu__empty">{t(lang, "fileMenuNoRecent")}</div>) : (renderItems(item.id === "open-recent"
                        ? recentWorkspaces.map((path) => ({
                            id: `recent:${path}`,
                            label: path.split(/[/\\]/).pop() ?? path,
                            detail: path,
                            onClick: item.onClick ? () => item.onClick?.(path) : undefined,
                        }))
                        : (item.submenu ?? []), true))}
            </div>) : null}
        </div>);
        });
    }
    return (<div className="titlebar-file-menu" ref={rootRef}>
      <button type="button" className={`titlebar-file-menu__trigger${open ? " titlebar-file-menu__trigger--open" : ""}`} onClick={() => {
            setOpen((value) => !value);
            setSubmenuId(null);
        }} aria-haspopup="menu" aria-expanded={open}>
        {t(lang, "fileMenu")}
      </button>

      {open ? (<div className="titlebar-file-menu__panel" role="menu">
          {renderItems(items)}
        </div>) : null}
    </div>);
}
