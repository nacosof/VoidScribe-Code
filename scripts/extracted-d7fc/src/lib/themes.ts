import type { UiTheme } from "@/types";

export function applyUiTheme(theme: UiTheme): void {
  document.documentElement.dataset.theme = theme;
}

export const UI_THEME_OPTIONS: UiTheme[] = ["voidscribe", "slate", "ocean"];
