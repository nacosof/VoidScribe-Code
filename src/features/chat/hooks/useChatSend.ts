import { useCallback } from "react";
import type { RefObject } from "react";
import type { useChatSessions } from "@/hooks/useChatSessions";
import { createId } from "@/lib/chat-sessions";
import { isPresetReady } from "@/lib/agent-presets";
import { resolveEffectiveChatMode, modeRequiresWorkspace, type ChatInteractionMode } from "@/lib/chat-modes";
import { t } from "@/lib/i18n";
import type { AgentPreset } from "@/lib/agent-presets";
import type { AgentEditorContext, ChatContextRef, ChatImage, ChatMessage, UiLanguage } from "@/types";
import type { StreamTarget } from "./useAgentStream";

type ChatsApi = ReturnType<typeof useChatSessions>;

type UseChatSendOptions = {
    lang: UiLanguage;
    mode: ChatInteractionMode;
    workspacePath: string;
    activePreset: AgentPreset | null;
    composer: string;
    composerImages: ChatImage[];
    composerContextRefs: ChatContextRef[];
    streaming: { requestId: string } | null;
    chatInflightRef: RefObject<string | null>;
    chats: ChatsApi;
    chatsRef: RefObject<ChatsApi>;
    editorContext?: AgentEditorContext;
    onComposerClear: () => void;
    onWorkspaceError: (message: string) => void;
    registerStream: (requestId: string, target: StreamTarget) => void;
    clearStream: (requestId: string) => void;
};

export function useChatSend({
    lang,
    mode,
    workspacePath,
    activePreset,
    composer,
    composerImages,
    composerContextRefs,
    streaming,
    chatInflightRef,
    chats,
    chatsRef,
    editorContext,
    onComposerClear,
    onWorkspaceError,
    registerStream,
    clearStream,
}: UseChatSendOptions) {
    const sendMessage = useCallback(async () => {
        const text = composer.trim();
        const hasAttachments = composerImages.length > 0 || composerContextRefs.length > 0;
        if ((!text && !hasAttachments) || streaming || chatInflightRef.current)
            return;

        const workspaceOpen = Boolean(workspacePath.trim());
        const effectiveMode = resolveEffectiveChatMode(mode, workspaceOpen);
        if (modeRequiresWorkspace(mode) && !workspaceOpen) {
            onWorkspaceError(t(lang, "chatModeNeedsWorkspace"));
            return;
        }
        if (composerContextRefs.length > 0 && !workspaceOpen) {
            onWorkspaceError(t(lang, "chatNeedsWorkspaceForFiles"));
            return;
        }
        if (mode === "agent" && (!activePreset || !isPresetReady(activePreset))) {
            onWorkspaceError(t(lang, "addKeyInSettings"));
            return;
        }

        onWorkspaceError("");
        const sessionId = chats.ensureSession();

        const user: ChatMessage = {
            id: createId(),
            role: "user",
            content: text,
            createdAt: Date.now(),
            mode: effectiveMode,
            images: composerImages.length ? composerImages : undefined,
            contextRefs: composerContextRefs.length ? composerContextRefs : undefined,
        };
        const assistant: ChatMessage = {
            id: createId(),
            role: "assistant",
            content: "",
            createdAt: Date.now(),
            mode: effectiveMode,
            agentActivities: [],
        };
        const history = [...chatsRef.current!.getSessionMessages(sessionId), user];
        chats.addMessage(sessionId, user);
        chats.addMessage(sessionId, assistant);
        onComposerClear();

        const requestId = createId();
        registerStream(requestId, { sessionId, messageId: assistant.id });

        try {
            const result = await window.voidscribe.streamChat({
                requestId,
                messages: history,
                mode: effectiveMode,
                editorContext,
            });
            if (!result.ok) {
                const message = result.error === "cancelled" || /aborted/i.test(result.error)
                    ? t(lang, "chatRequestCancelled")
                    : result.error;
                chats.updateMessage(sessionId, assistant.id, { content: message });
            }
        }
        finally {
            clearStream(requestId);
        }
    }, [
        activePreset,
        chatInflightRef,
        chats,
        chatsRef,
        clearStream,
        composer,
        composerContextRefs,
        composerImages,
        lang,
        mode,
        onComposerClear,
        onWorkspaceError,
        registerStream,
        streaming,
        editorContext,
        workspacePath,
    ]);

    return { sendMessage };
}
