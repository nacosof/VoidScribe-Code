import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { useChatSessions } from "@/hooks/useChatSessions";
import type { WorkspaceConsoleHandle } from "@/components/WorkspaceConsole";
import { createId } from "@/lib/chat-sessions";
import { formatAgentCompletionMessage } from "@/lib/agent-activity-ui";
import { t } from "@/lib/i18n";
import type { AgentActivity, ChatMessage, UiLanguage } from "@/types";

type ChatsApi = ReturnType<typeof useChatSessions>;

export type StreamTarget = {
    sessionId: string;
    messageId: string;
};

type FileChangeEvent = {
    type: "file_change";
    path: string;
    kind: "created" | "modified" | "deleted";
    previousContent: string | null;
    newContent: string;
};

type UseAgentStreamOptions = {
    lang: UiLanguage;
    workspacePath: string;
    chatsRef: RefObject<ChatsApi>;
    consoleRef: RefObject<WorkspaceConsoleHandle | null>;
    refreshTree: () => void;
    autoOpenTerminal?: boolean;
    onTerminalOpen: () => void;
    onFileChange: (sessionId: string, event: Omit<FileChangeEvent, "type">) => void;
    verifyPendingAfterFlush: (sessionId: string) => Promise<void>;
};

export function useAgentStream({
    lang,
    workspacePath,
    chatsRef,
    consoleRef,
    refreshTree,
    autoOpenTerminal = true,
    onTerminalOpen,
    onFileChange,
    verifyPendingAfterFlush,
}: UseAgentStreamOptions) {
    const [streaming, setStreaming] = useState<StreamTarget & {
        requestId: string;
    } | null>(null);
    const chatInflightRef = useRef<string | null>(null);
    const streamTargetsRef = useRef(new Map<string, StreamTarget>());

    useEffect(() => {
        const offDelta = window.voidscribe.onChatDelta(({ requestId, delta }) => {
            const target = streamTargetsRef.current.get(requestId);
            if (!target)
                return;
            chatsRef.current?.appendMessageDelta(target.sessionId, target.messageId, delta);
        });

        const offDone = window.voidscribe.onChatDone(({ requestId }) => {
            const target = streamTargetsRef.current.get(requestId);
            if (target) {
                const message = chatsRef.current?.getMessage(target.sessionId, target.messageId);
                if (message?.role === "assistant" && !message.content.trim()) {
                    const summary = formatAgentCompletionMessage(message.agentActivities ?? [], lang);
                    if (summary) {
                        chatsRef.current?.updateMessage(target.sessionId, target.messageId, {
                            content: summary,
                        });
                    }
                }
            }
            streamTargetsRef.current.delete(requestId);
            if (chatInflightRef.current === requestId) {
                chatInflightRef.current = null;
            }
            setStreaming((current) => (current?.requestId === requestId ? null : current));
            if (workspacePath.trim()) {
                void window.voidscribe.flushAgentStagedFiles().then(async () => {
                    refreshTree();
                    if (target?.sessionId) {
                        await verifyPendingAfterFlush(target.sessionId);
                    }
                });
            }
        });

        const offError = window.voidscribe.onChatError(({ requestId, error }) => {
            const target = streamTargetsRef.current.get(requestId);
            streamTargetsRef.current.delete(requestId);
            if (chatInflightRef.current === requestId) {
                chatInflightRef.current = null;
            }
            if (!target)
                return;
            const message = error === "cancelled" || /aborted/i.test(error)
                ? t(lang, "chatRequestCancelled")
                : error;
            chatsRef.current?.updateMessage(target.sessionId, target.messageId, {
                content: message,
            });
            setStreaming((prev) => (prev?.requestId === requestId ? null : prev));
        });

        const offEvent = window.voidscribe.onAgentEvent(({ requestId, event }) => {
            const target = streamTargetsRef.current.get(requestId);
            if (!target)
                return;
            const session = chatsRef.current?.sessions.find((item) => item.id === target.sessionId);
            const message = session?.messages.find((item) => item.id === target.messageId);
            const activity = { ...(event as AgentActivity), at: Date.now() };
            let activityForMessage = activity;

            if (event.type === "file_change") {
                const fileEvent = event as FileChangeEvent;
                const checkpointId = createId();
                chatsRef.current?.addCheckpoint(target.sessionId, {
                    id: checkpointId,
                    messageId: target.messageId,
                    activityAt: activity.at,
                    label: `${fileEvent.kind} ${fileEvent.path}`,
                    files: {
                        [fileEvent.path]: {
                            before: fileEvent.previousContent,
                            after: fileEvent.newContent,
                        },
                    },
                });
                activityForMessage = { ...activity, checkpointId };
            }

            const next: AgentActivity[] = [
                ...(message?.agentActivities ?? []),
                activityForMessage,
            ];
            const patch: Partial<ChatMessage> = { agentActivities: next };
            if (message &&
                message.contentSplitIndex === undefined &&
                (activity.type === "file_change" ||
                    activity.type === "console_command" ||
                    (activity.type === "tool_start" && activity.name !== "model"))) {
                patch.contentSplitIndex = message.content.length;
                patch.activitySplitIndex = message.agentActivities?.length ?? 0;
            }

            const isShellActivity = event.type === "console_command" ||
                (event.type === "tool_start" && (event as AgentActivity).name === "run_command");
            if (isShellActivity && autoOpenTerminal) {
                onTerminalOpen();
            }

            chatsRef.current?.updateMessage(target.sessionId, target.messageId, patch);
            consoleRef.current?.handleActivity(activity);

            if (isShellActivity) {
                void window.voidscribe.terminalEnsureAgentMirror();
            }

            if (event.type === "file_change") {
                const fileEvent = event as FileChangeEvent;
                onFileChange(target.sessionId, {
                    path: fileEvent.path,
                    kind: fileEvent.kind,
                    previousContent: fileEvent.previousContent,
                    newContent: fileEvent.newContent,
                });
            }
        });

        const offTranscript = window.voidscribe.onAgentTranscript(({ requestId, turns }) => {
            const target = streamTargetsRef.current.get(requestId);
            if (!target)
                return;
            chatsRef.current?.updateMessage(target.sessionId, target.messageId, {
                agentTranscript: turns,
            });
        });

        return () => {
            offDelta();
            offDone();
            offError();
            offEvent();
            offTranscript();
        };
    }, [lang, workspacePath, chatsRef, consoleRef, refreshTree, autoOpenTerminal, onTerminalOpen, onFileChange, verifyPendingAfterFlush]);

    const registerStream = (requestId: string, target: StreamTarget) => {
        chatInflightRef.current = requestId;
        streamTargetsRef.current.set(requestId, target);
        setStreaming({ requestId, ...target });
    };

    const clearStream = (requestId: string) => {
        streamTargetsRef.current.delete(requestId);
        if (chatInflightRef.current === requestId) {
            chatInflightRef.current = null;
        }
        setStreaming((current) => (current?.requestId === requestId ? null : current));
    };

    const cancelStream = async (requestId: string) => {
        await window.voidscribe.cancelChat(requestId);
        clearStream(requestId);
    };

    return {
        streaming,
        chatInflightRef,
        streamTargetsRef,
        registerStream,
        clearStream,
        cancelStream,
        stopGeneration: async () => {
            await window.voidscribe.interruptAgent();
            if (!streaming)
                return;
            await cancelStream(streaming.requestId);
        },
    };
}
