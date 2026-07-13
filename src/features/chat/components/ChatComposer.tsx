import { ChatModeSelector } from "@/components/ChatModeSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { AgentChangesBar } from "@/components/AgentChangesBar";
import { ComposerContextChips, handleComposerPaste } from "@/components/ComposerContextChips";
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
    composerInputRef?: RefObject<HTMLTextAreaElement | null>;
    sessionPending: PendingFileChange[];
    onComposerChange: (value: string) => void;
    onImagesChange: (images: ChatImage[]) => void;
    onContextRefsChange: (refs: ChatContextRef[]) => void;
    onModeChange: (mode: ChatInteractionMode) => void;
    onSelectPreset: (presetId: string) => void;
    onOpenSettings: () => void;
    onAttachFile: () => void | Promise<void>;
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
    composerInputRef,
    sessionPending,
    onComposerChange,
    onImagesChange,
    onContextRefsChange,
    onModeChange,
    onSelectPreset,
    onOpenSettings,
    onAttachFile,
    onSend,
    onStop,
    onUndoPending,
    onKeepPending,
    onOpenFile,
}: ChatComposerProps) {
    const canSend = Boolean(composer.trim()) || composerImages.length > 0 || composerContextRefs.length > 0;
    const canAttachFile = hasWorkspace && !streaming;

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
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M12 21V3" />
                                    <path d="M5 11l7-7 7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="composer__footer">
                        <div className="composer__toolbar">
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
                        <button
                            type="button"
                            className="composer__attach-btn"
                            disabled={!canAttachFile}
                            onClick={() => void onAttachFile()}
                            title={canAttachFile ? t(lang, "attachFile") : t(lang, "chatNeedsWorkspaceForFiles")}
                            aria-label={canAttachFile ? t(lang, "attachFile") : t(lang, "chatNeedsWorkspaceForFiles")}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                        </button>
                    </div>
                </ComposerContextChips>
            </div>
        </div>
    );
}
