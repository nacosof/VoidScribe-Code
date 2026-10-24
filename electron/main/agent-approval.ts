import { randomUUID } from "crypto";
import {
    normalizeAgentPermissionMode,
    permissionAllowsTool,
    type AgentPermissionMode,
} from "../../src/lib/agent-permission";
import { getSettings } from "./store";

export type { AgentPermissionMode };

export type AgentApprovalKind = "run_command" | "mcp" | "delete_path" | "auto_install" | "write";

export type AgentApprovalRequest = {
    id: string;
    kind: AgentApprovalKind;
    title: string;
    detail: string;
    fingerprint: string;
};

export type AgentApprovalDecision = "allow" | "deny" | "always";

type Pending = {
    resolve: (decision: "allow" | "deny") => void;
    fingerprint: string;
    kind: AgentApprovalKind;
};

let sendApprovalRequest: ((payload: AgentApprovalRequest) => void) | null = null;
const pending = new Map<string, Pending>();
const sessionAlways = new Set<string>();

export function setAgentApprovalSender(send: (payload: AgentApprovalRequest) => void): void {
    sendApprovalRequest = send;
}

export { normalizeAgentPermissionMode };

export function getAgentPermissionMode(): AgentPermissionMode {
    return normalizeAgentPermissionMode((getSettings() as { agentPermissionMode?: string }).agentPermissionMode);
}

export function clearAgentApprovals(): void {
    for (const [id, item] of pending) {
        pending.delete(id);
        item.resolve("deny");
    }
}

export function resolveAgentApproval(id: string, decision: AgentApprovalDecision): boolean {
    const item = pending.get(id);
    if (!item)
        return false;
    pending.delete(id);
    if (decision === "always") {
        sessionAlways.add(`${item.kind}:${item.fingerprint}`);
        sessionAlways.add(`${item.kind}:*`);
        item.resolve("allow");
        return true;
    }
    item.resolve(decision === "allow" ? "allow" : "deny");
    return true;
}

export async function requestAgentApproval(input: {
    kind: AgentApprovalKind;
    title: string;
    detail: string;
    fingerprint: string;
    signal?: AbortSignal;
    /** When set, skip UI if mode allows this tool automatically. */
    toolName?: string;
}): Promise<"allow" | "deny"> {
    const mode = getAgentPermissionMode();
    const toolName = input.toolName ?? input.kind;
    const policy = permissionAllowsTool(mode, toolName);
    if (policy === "allow" || mode === "full")
        return "allow";
    if (policy === "deny")
        return "deny";
    if (sessionAlways.has(`${input.kind}:*`) || sessionAlways.has(`${input.kind}:${input.fingerprint}`))
        return "allow";
    if (!sendApprovalRequest)
        return "allow";
    if (input.signal?.aborted)
        return "deny";

    const id = randomUUID();
    const payload: AgentApprovalRequest = {
        id,
        kind: input.kind,
        title: input.title,
        detail: input.detail,
        fingerprint: input.fingerprint,
    };

    return new Promise((resolve) => {
        const finish = (decision: "allow" | "deny") => {
            input.signal?.removeEventListener("abort", onAbort);
            resolve(decision);
        };
        const onAbort = () => {
            if (!pending.has(id))
                return;
            pending.delete(id);
            finish("deny");
        };
        pending.set(id, {
            resolve: finish,
            fingerprint: input.fingerprint,
            kind: input.kind,
        });
        input.signal?.addEventListener("abort", onAbort, { once: true });
        try {
            sendApprovalRequest?.(payload);
        }
        catch {
            pending.delete(id);
            finish("deny");
        }
    });
}
