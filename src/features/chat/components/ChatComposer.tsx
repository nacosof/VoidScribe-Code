import { ChatModeSelector } from "@/components/ChatModeSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { AgentChangesBar } from "@/components/AgentChangesBar";
import { ComposerContextChips, handleComposerPaste } from "@/components/ComposerContextChips";
import { chatContextRefFromPath, mergeContextRefs } from "@/lib/chat-context";
import { t } from "@/lib/i18n";
import type { RefObject } from "react";
import type { ChatInteractionMode } from "@/lib/chat-modes";
import type { AiSettings, ChatContextRef, ChatImage, PendingFileChange, UiLanguage } from "@/types";

type ChatComposerProps = {
    lang: UiLanguage;
    mode: ChatInteractionMode;
    hasWorkspace: boolean;
    settings: AiSettings;
    workspacePath: string;
    workspaceError: string;
    composer: string;
    composerImages: ChatImage[];
    composerContextRefs: ChatContextRef[];
    streaming: boolean;
    composerSupportsVision: boolean;
    activeEditorPath: string | null;
    composerInputRef?: RefObject<HTMLTextAreaElement | null>;
    sessionPending: PendingFileChange[];
    onComposerChange: (value: string) => void;
    onImagesChange: (images: ChatImage[]) => void;
    onContextRefsChange: (refs: ChatContextRef[]) => void;
    onModeChange: (mode: ChatInteractionMode) => void;
    onSelectPreset: (presetId: string) => void;
    onOpenSettings: () => void;
    onSend: () => void;
    onStop: () => void;
    onUndoPending: (change: PendingFileChange) => void;
    onKeepPending: (change: PendingFileChange) => void;
    onOpenFile: (path: string) => void;
};

export function ChatComposer({
    lang,
    mode,
    hasWorkspace,
    settings,
    workspacePath,
    workspaceError,
    composer,
    composerImages,
    composerContextRefs,
    streaming,
    composerSupportsVision,
    activeEditorPath,
    composerInputRef,
    sessionPending,
    onComposerChange,
    onImagesChange,
    onContextRefsChange,
    onModeChange,
    onSelectPreset,
    onOpenSettings,
    onSend,
    onStop,
    onUndoPending,
    onKeepPending,
    onOpenFile,
}: ChatComposerProps) {
    const canSend = Boolean(composer.trim()) || composerImages.length > 0 || composerContextRefs.length > 0;
    const canAttachCurrentFile = Boolean(activeEditorPath?.trim()) && !streaming;

    function handleAttachCurrentFile() {
        if (!activeEditorPath?.trim() || streaming)
            return;
        onContextRefsChange(mergeContextRefs(composerContextRefs, chatContextRefFromPath(activeEditorPath)));
    }

    return (
        <div className="composer">
            {workspaceError ? <p className="composer__error">{workspaceError}</p> : null}
            <div className="composer__stack">
                <AgentChangesBar
                    changes={sessionPending}
                    lang={lang}
                    onUndoAll={() => void Promise.all(sessionPending.map((item) => onUndoPending(item)))}
                    onKeepAll={() => void Promise.all(sessionPending.map((item) => onKeepPending(item)))}
                    onUndoOne={(id) => {
                        const change = sessionPending.find((item) => item.id === id);
                        if (change)
                            void onUndoPending(change);
                    }}
                    onKeepOne={(id) => {
                        const change = sessionPending.find((item) => item.id === id);
                        if (change)
                            onKeepPending(change);
                    }}
                    onOpenFile={(path) => void onOpenFile(path)}
                />
                <ComposerContextChips
                    refs={composerContextRefs}
                    images={composerImages}
                    lang={lang}
                    workspacePath={workspacePath}
                    supportsVision={composerSupportsVision}
                    disabled={streaming}
                    onRefsChange={onContextRefsChange}
                    onImagesChange={onImagesChange}
                >
                    <div className="composer__box">
                        <textarea
                            ref={composerInputRef}
                            className="composer__input"
                            value={composer}
                            onChange={(e) => onComposerChange(e.target.value)}
                            onPaste={(event) => {
                                void handleComposerPaste(event, composerImages, onImagesChange);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void onSend();
                                }
                            }}
                            placeholder={t(lang, "chatPlaceholder")}
                        />
                        {streaming ? (
                            <button
                                type="button"
                                className="btn-send btn-send--stop"
                                onClick={() => void onStop()}
                                aria-label={t(lang, "stopGeneration")}
                                title={t(lang, "stopGeneration")}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <rect x="6" y="6" width="12" height="12" rx="1.5" />
                                </svg>
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="btn-send"
                                disabled={!canSend}
                                onClick={() => void onSend()}
                                aria-label={t(lang, "send")}
                                title={t(lang, "send")}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M12 19V5" />
                                    <path d="M5 12l7-7 7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="composer__toolbar">
                        {activeEditorPath ? (
                            <button
                                type="button"
                                className="composer__attach-btn"
                                disabled={!canAttachCurrentFile}
                                onClick={handleAttachCurrentFile}
                                title={t(lang, "attachCurrentFile")}
                                aria-label={t(lang, "attachCurrentFile")}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M8 6h8M8 10h8M8 14h5" />
                                    <rect x="5" y="4" width="14" height="16" rx="2" />
                                </svg>
                            </button>
                        ) : null}
                        <ChatModeSelector
                            mode={mode}
                            hasWorkspace={hasWorkspace}
                            lang={lang}
                            disabled={streaming}
                            onChange={onModeChange}
                        />
                        <ModelSelector
                            settings={settings}
                            lang={lang}
                            disabled={streaming}
                            onSelectPreset={(presetId) => void onSelectPreset(presetId)}
                            onOpenSettings={onOpenSettings}
                        />
                    </div>
                </ComposerContextChips>
            </div>
        </div>
    );
}
