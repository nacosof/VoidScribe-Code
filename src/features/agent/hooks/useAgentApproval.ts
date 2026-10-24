import { useCallback, useEffect, useState } from "react";
import type { AgentApprovalRequestPayload } from "@/components/AgentApprovalDialog";

export function useAgentApproval() {
    const [request, setRequest] = useState<AgentApprovalRequestPayload | null>(null);

    useEffect(() => {
        return window.voidscribe.onAgentApprovalRequest((payload) => {
            setRequest(payload);
        });
    }, []);

    const respond = useCallback(async (decision: "allow" | "deny" | "always") => {
        const current = request;
        if (!current)
            return;
        setRequest(null);
        await window.voidscribe.respondAgentApproval({ id: current.id, decision });
    }, [request]);

    return { request, respond };
}
