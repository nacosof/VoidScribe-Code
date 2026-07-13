export const MAX_LOG_LINES = 800;
export const TERMINAL_HEIGHT_KEY = "voidscribe-terminal-height";
export const DEFAULT_TERMINAL_HEIGHT = 220;
export const MIN_TERMINAL_HEIGHT = 120;
export const MIN_EDITOR_HEIGHT = 0;
export const EDITOR_TABBAR_HEIGHT = 35;
export const MAX_TERMINAL_HEIGHT_RATIO = 0.95;

export const PANEL_TABS = [
    { id: "problems", label: "Problems", enabled: true },
    { id: "output", label: "Output", enabled: true },
    { id: "debug", label: "Debug Console", enabled: true },
    { id: "terminal", label: "Terminal", enabled: true },
    { id: "ports", label: "Ports", enabled: true },
] as const;

export type PanelTabId = (typeof PANEL_TABS)[number]["id"];

export function appendLogLine(lines: string[], line: string): string[] {
    const next = [...lines, line];
    return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
}

export function getMaxTerminalHeight(shell: HTMLElement | null): number {
    if (!shell) {
        return Math.floor(window.innerHeight * MAX_TERMINAL_HEIGHT_RATIO);
    }
    const tabbar = shell.querySelector<HTMLElement>(".editor-tabs, .chat-tabs--panel");
    const tabbarHeight = tabbar?.offsetHeight ?? EDITOR_TABBAR_HEIGHT;
    return Math.max(
        MIN_TERMINAL_HEIGHT,
        shell.clientHeight - tabbarHeight - MIN_EDITOR_HEIGHT,
    );
}

export function clampTerminalHeight(height: number, max?: number): number {
    const ceiling = max ?? Math.floor(window.innerHeight * MAX_TERMINAL_HEIGHT_RATIO);
    return Math.min(ceiling, Math.max(MIN_TERMINAL_HEIGHT, Math.round(height)));
}

/** Bare LF (no CR) only moves the cursor down in xterm — normalize for mirror/pipe output. */
export function normalizeXtermOutput(data: string): string {
    return data.replace(/(?<!\r)\n/g, "\r\n");
}

export function persistTerminalHeight(height: number): void {
    try {
        localStorage.setItem(TERMINAL_HEIGHT_KEY, String(height));
    }
    catch {
    }
}

export function readStoredTerminalHeight(): number {
    try {
        const saved = localStorage.getItem(TERMINAL_HEIGHT_KEY);
        if (saved)
            return clampTerminalHeight(Number(saved));
    }
    catch {
    }
    return DEFAULT_TERMINAL_HEIGHT;
}
