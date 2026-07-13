import { store } from "./store";
import { restartWorkspaceWatcher } from "./workspace-watcher";
import type { IpcContext } from "./ipc/context";
import { pushRecentWorkspace } from "./ipc/context";

export type WorkspaceOpenedPayload = {
    workspacePath: string;
    recentWorkspaces: string[];
    filePath?: string;
};

export function assignWorkspaceSession(ctx: IpcContext, path: string): string[] {
    ctx.setWorkspacePath(path);
    store.set("workspacePath", path);
    const recent = pushRecentWorkspace(path);
    restartWorkspaceWatcher(path);
    return recent;
}

export function notifyWorkspaceOpened(ctx: IpcContext, payload: WorkspaceOpenedPayload): void {
    ctx.send("workspace:opened", payload);
}
