import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

export type AgentApprovalRequestPayload = {
    id: string;
    kind: "run_command" | "mcp" | "delete_path" | "auto_install" | "write";
    title: string;
    detail: string;
    fingerprint: string;
};

type AgentApprovalDialogProps = {
    request: AgentApprovalRequestPayload | null;
    lang: UiLanguage;
    onRespond: (decision: "allow" | "deny" | "always") => void;
};

export function AgentApprovalDialog({ request, lang, onRespond }: AgentApprovalDialogProps) {
    if (!request)
        return null;
    return createPortal(
        <div className="modal-backdrop" onClick={() => onRespond("deny")}>
            <div
                className="modal modal--compact"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="agent-approval-title"
                aria-describedby="agent-approval-detail"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="agent-approval-title">{request.title || t(lang, "agentApprovalTitle")}</h2>
                <pre id="agent-approval-detail" className="modal__pre">{request.detail}</pre>
                <div className="modal__actions modal__actions--wrap">
                    <button type="button" className="btn btn--ghost" onClick={() => onRespond("deny")}>
                        {t(lang, "agentApprovalDeny")}
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={() => onRespond("always")}>
                        {t(lang, "agentApprovalAlways")}
                    </button>
                    <button type="button" className="btn btn--primary" onClick={() => onRespond("allow")}>
                        {t(lang, "agentApprovalAllow")}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
