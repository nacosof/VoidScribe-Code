export function readThemeVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function getTerminalTheme() {
  const bg = readThemeVar("--abyss-gray", "#0b0d13");
  const fg = readThemeVar("--pale-nebula", "#e6e9f0");
  const accent = readThemeVar("--void-purple-hover", "#7e41b4");
  const selection = readThemeVar("--accent-soft", "rgba(81, 44, 132, 0.35)");

  return {
    background: bg,
    foreground: fg,
    cursor: accent,
    cursorAccent: bg,
    selectionBackground: selection,
    black: "#1e1e1e",
    red: readThemeVar("--blood-ink", "#e8a0a0"),
    green: readThemeVar("--wisp-green", "#4b9b6e"),
    yellow: fg,
    blue: readThemeVar("--cold-constellation", "#9eb4ff"),
    magenta: accent,
    cyan: "#7ec8e3",
    white: fg,
    brightBlack: readThemeVar("--stardust-gray", "#8a8f9e"),
    brightRed: "#f48771",
    brightGreen: "#6fcf97",
    brightYellow: "#ffffff",
    brightBlue: "#b8c4ff",
    brightMagenta: accent,
    brightCyan: "#9ad9ef",
    brightWhite: "#ffffff",
  };
}
