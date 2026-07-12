export const MAX_LOG_LINES = 800;
export const TERMINAL_HEIGHT_KEY = "voidscribe-terminal-height";
export const DEFAULT_TERMINAL_HEIGHT = 220;
export const MIN_TERMINAL_HEIGHT = 120;
export const MAX_TERMINAL_HEIGHT_RATIO = 0.72;

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

export function clampTerminalHeight(height: number): number {
    const max = Math.floor(window.innerHeight * MAX_TERMINAL_HEIGHT_RATIO);
    return Math.min(max, Math.max(MIN_TERMINAL_HEIGHT, Math.round(height)));
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
