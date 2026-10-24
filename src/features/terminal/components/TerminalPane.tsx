import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { attachTerminalLinks, openTerminalLink } from "@/lib/terminal-links";
import type { UiLanguage } from "@/types";
import { createTerminalTheme } from "../lib/terminal-theme";
import { TerminalContextMenu, type TerminalContextMenuState } from "./TerminalContextMenu";

export type TerminalPaneProps = {
    sessionId: string;
    active: boolean;
    readonly?: boolean;
    lang: UiLanguage;
    onInterrupt?: () => void;
    onRegister: (sessionId: string, term: Terminal, fit: FitAddon) => void;
    onUnregister: (sessionId: string) => void;
};

export function TerminalPane({
    sessionId,
    active,
    readonly = false,
    lang,
    onInterrupt,
    onRegister,
    onUnregister,
}: TerminalPaneProps) {
    const hostRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const onInterruptRef = useRef(onInterrupt);
    const onRegisterRef = useRef(onRegister);
    const onUnregisterRef = useRef(onUnregister);
    const [menu, setMenu] = useState<TerminalContextMenuState | null>(null);
    onInterruptRef.current = onInterrupt;
    onRegisterRef.current = onRegister;
    onUnregisterRef.current = onUnregister;

    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return;
        const term = new Terminal({
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 13,
            lineHeight: 1.25,
            cursorBlink: !readonly,
            cursorStyle: "block",
            disableStdin: readonly,
            scrollback: 5000,
            theme: createTerminalTheme(),
            allowProposedApi: true,
            linkHandler: {
                allowNonHttpProtocols: false,
                activate(event, text) {
                    openTerminalLink(event, text);
                },
            },
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(host);
        const linkDisposables = attachTerminalLinks(term);
        termRef.current = term;
        fitRef.current = fit;
        term.onData((data) => {
            if (readonly) {
                // Ctrl+C with a selection is copy — don't kill the agent.
                if (data.includes("\x03") && !term.hasSelection())
                    onInterruptRef.current?.();
                return;
            }
            void window.voidscribe.terminalWrite(sessionId, data);
        });
        term.attachCustomKeyEventHandler((event) => {
            if (!readonly || !onInterruptRef.current)
                return true;
            if (event.ctrlKey && event.key === "c" && event.type === "keydown") {
                if (term.hasSelection())
                    return true;
                onInterruptRef.current();
                return false;
            }
            return true;
        });
        onRegisterRef.current(sessionId, term, fit);
        return () => {
            termRef.current = null;
            fitRef.current = null;
            onUnregisterRef.current(sessionId);
            for (const disposable of linkDisposables) {
                disposable.dispose();
            }
            term.dispose();
        };
    }, [sessionId, readonly]);

    useEffect(() => {
        if (!active)
            return;
        const term = termRef.current;
        const fit = fitRef.current;
        const host = hostRef.current;
        if (!term || !fit)
            return;
        const applyFit = () => {
            try {
                fit.fit();
                const cols = Math.max(2, term.cols);
                const rows = Math.max(1, term.rows);
                void window.voidscribe.terminalResize(sessionId, cols, rows);
                term.scrollToBottom();
                term.focus();
            }
            catch {
            }
        };
        requestAnimationFrame(applyFit);
        const t1 = window.setTimeout(applyFit, 50);
        const t2 = window.setTimeout(applyFit, 180);
        let observer: ResizeObserver | null = null;
        if (host && typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(() => applyFit());
            observer.observe(host);
        }
        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            observer?.disconnect();
        };
    }, [active, sessionId]);

    const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        const term = termRef.current;
        setMenu({
            x: event.clientX,
            y: event.clientY,
            canCopy: Boolean(term?.hasSelection()),
        });
    }, []);

    const handleCopy = useCallback(() => {
        const text = termRef.current?.getSelection() ?? "";
        if (!text)
            return;
        void navigator.clipboard.writeText(text);
    }, []);

    const handlePaste = useCallback(async () => {
        if (readonly)
            return;
        const text = await navigator.clipboard.readText().catch(() => "");
        if (text && termRef.current) {
            termRef.current.paste(text);
        }
    }, [readonly]);

    return (
        <div
            className={`terminal-panel__pane${active ? " terminal-panel__pane--active" : ""}`}
            aria-hidden={!active}
            onContextMenu={handleContextMenu}
        >
            <div ref={hostRef} className="terminal-panel__xterm" />
            {menu ? (
                <TerminalContextMenu
                    menu={menu}
                    lang={lang}
                    canPaste={!readonly}
                    onCopy={handleCopy}
                    onPaste={handlePaste}
                    onClose={() => setMenu(null)}
                />
            ) : null}
        </div>
    );
}
