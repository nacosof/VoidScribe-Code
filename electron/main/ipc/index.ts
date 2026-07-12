import type { IpcContext } from "./context";
import { registerChatHandlers } from "./chat-handlers";
import { registerSettingsHandlers } from "./settings-handlers";
import { registerTerminalHandlers } from "./terminal-handlers";
import { registerWindowHandlers } from "./window-handlers";
import { registerWorkspaceHandlers } from "./workspace-handlers";

export function registerAllIpcHandlers(ctx: IpcContext): void {
    registerSettingsHandlers(ctx);
    registerWorkspaceHandlers(ctx);
    registerTerminalHandlers(ctx);
    registerChatHandlers(ctx);
    registerWindowHandlers(ctx);
}

export type { IpcContext } from "./context";
