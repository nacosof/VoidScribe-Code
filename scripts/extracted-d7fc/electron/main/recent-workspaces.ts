import { settingsStore } from "./store";

const RECENT_KEY = "recentWorkspaces";
const MAX_RECENT = 10;

export function getRecentWorkspaces(): string[] {
  const value = settingsStore.get(RECENT_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function pushRecentWorkspace(path: string): string[] {
  const trimmed = path.trim();
  if (!trimmed) return getRecentWorkspaces();

  const next = [trimmed, ...getRecentWorkspaces().filter((item) => item !== trimmed)].slice(
    0,
    MAX_RECENT
  );
  settingsStore.set(RECENT_KEY, next);
  return next;
}
