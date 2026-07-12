export const THEMES = ["voidscribe", "slate", "ocean"] as const;
export type ThemeId = (typeof THEMES)[number];
