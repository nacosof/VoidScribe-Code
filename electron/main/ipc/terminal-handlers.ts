import { ipcMain } from "electron";
import {
    createSession,
    ensureAgentMirrorSession,
    killSession,
    listSessions,
    resizePty,
    selectSession,
    writePty,
} from "../pty-manager";
import { runWorkspaceCommand } from "../terminal";
import { assertWorkspaceRoot } from "../workspace";
import type { IpcContext } from "./context";
import { fail, ok } from "./context";

function currentWorkspace(ctx: IpcContext): string {
    return assertWorkspaceRoot(ctx.getWorkspacePath());
}

export function registerTerminalHandlers(ctx: IpcContext): void {
    ipcMain.handle("terminal:run", async (_e, command: string, cwd = ".") => {
        try {
            return ok({ result: await runWorkspaceCommand(currentWorkspace(ctx), command, cwd) });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("terminal:list", () => ok(listSessions()));

    ipcMain.handle("terminal:create", (_e, cwd?: string) => {
        try {
            const result = createSession(cwd ?? currentWorkspace(ctx));
            if (!result.ok)
                return { ok: false, error: result.error };
            return ok({ session: result.session });
        }
        catch (err) {
            return fail(err);
        }
    });

    ipcMain.handle("terminal:select", (_e, sessionId: string) => ok({ selected: selectSession(sessionId) }));

    ipcMain.handle("terminal:write", (_e, payload: { sessionId: string; data: string }) => {
        writePty(payload.sessionId, payload.data);
        return ok({});
    });

    ipcMain.handle("terminal:resize", (_e, payload: { sessionId: string; cols: number; rows: number }) => {
        resizePty(payload.sessionId, payload.cols, payload.rows);
        return ok({});
    });

    ipcMain.handle("terminal:kill", (_e, sessionId: string) => ok(killSession(sessionId)));

    ipcMain.handle("terminal:ensureAgentMirror", () => {
        try {
            const session = ensureAgentMirrorSession(currentWorkspace(ctx));
            return ok({ session, ...listSessions() });
        }
        catch (err) {
            return fail(err);
        }
    });
}
