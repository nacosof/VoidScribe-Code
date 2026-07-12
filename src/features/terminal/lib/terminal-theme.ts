const TERMINAL_THEME_BASE = {
    foreground: "#e6e9f0",
    cursor: "#e6e9f0",
    selectionBackground: "rgba(255, 255, 255, 0.18)",
    selectionForeground: "#ffffff",
    black: "#e6e9f0",
    red: "#e6e9f0",
    green: "#e6e9f0",
    yellow: "#e6e9f0",
    blue: "#e6e9f0",
    magenta: "#e6e9f0",
    cyan: "#e6e9f0",
    white: "#e6e9f0",
    brightBlack: "#e6e9f0",
    brightRed: "#ffffff",
    brightGreen: "#ffffff",
    brightYellow: "#ffffff",
    brightBlue: "#ffffff",
    brightMagenta: "#ffffff",
    brightCyan: "#ffffff",
    brightWhite: "#ffffff",
};

function readTerminalSurfaceColor(): string {
    if (typeof document === "undefined")
        return "#191c22";
    const styles = getComputedStyle(document.documentElement);
    return (styles.getPropertyValue("--terminal-bg").trim() ||
        styles.getPropertyValue("--sidebar-bg").trim() ||
        styles.getPropertyValue("--chrome-bg").trim() ||
        "#191c22");
}

export function createTerminalTheme() {
    const background = readTerminalSurfaceColor();
    return {
        ...TERMINAL_THEME_BASE,
        background,
        cursorAccent: background,
    };
}
