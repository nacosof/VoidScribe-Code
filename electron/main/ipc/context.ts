import type { BrowserWindow } from "electron";
import { store } from "../store";

export type IpcOk<T> = { ok: true } & T;
export type IpcFail = { ok: false; error: string };

export type IpcContext = {
    getMainWindow: () => BrowserWindow | null;
    getWorkspacePath: () => string;
    setWorkspacePath: (path: string) => void;
    send: (channel: string, payload: unknown) => void;
    applyZoomLevel: (level: number) => number;
};

export function ok<T extends Record<string, unknown>>(value: T): IpcOk<T> {
    return { ok: true, ...value };
}

export function fail(err: unknown): IpcFail {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

export function pushRecentWorkspace(path: string): string[] {
    const recent = [path, ...(store.get("recentWorkspaces") ?? []).filter((item) => item !== path)].slice(0, 10);
    store.set("recentWorkspaces", recent);
    return recent;
}
