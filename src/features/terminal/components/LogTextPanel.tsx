import type { MouseEvent, RefObject } from "react";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type LogTextPanelProps = {
    lang: UiLanguage;
    lines: string[];
    emptyKey: "consoleNoOutput" | "consoleNoDebug";
    scrollRef: RefObject<HTMLDivElement | null>;
    onContextMenu: (event: MouseEvent<HTMLElement>) => void;
};

export function LogTextPanel({
    lang,
    lines,
    emptyKey,
    scrollRef,
    onContextMenu,
}: LogTextPanelProps) {
    if (!lines.length) {
        return (
            <div className="terminal-panel__scroll terminal-panel__scroll--empty overlay-scrollbar">
                <p>{t(lang, emptyKey)}</p>
            </div>
        );
    }
    return (
        <div ref={scrollRef} className="terminal-panel__scroll overlay-scrollbar" onContextMenu={onContextMenu}>
            {lines.map((line, index) => (
                <div key={`${index}-${line.slice(0, 24)}`} className="terminal-line">
                    {line}
                </div>
            ))}
        </div>
    );
}
