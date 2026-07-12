import { useState, type ReactNode } from "react";
import type { ChatContextRef, ChatImage, UiLanguage } from "@/types";
import { CHAT_ENTRY_DRAG_MIME, mergeContextRefs, readDraggedChatEntry, readDroppedWorkspaceRefs, } from "@/lib/chat-context";
import { mergeChatImages, readDroppedImageFiles, readClipboardImages, } from "@/lib/chat-images";
import { t } from "@/lib/i18n";
type ComposerContextChipsProps = {
    refs: ChatContextRef[];
    images: ChatImage[];
    lang: UiLanguage;
    workspacePath: string;
    supportsVision: boolean;
    disabled?: boolean;
    onRefsChange: (refs: ChatContextRef[]) => void;
    onImagesChange: (images: ChatImage[]) => void;
    children: ReactNode;
};
function ContextChipIcon({ kind }: {
    kind: ChatContextRef["kind"];
}) {
    if (kind === "directory") {
        return (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
      </svg>);
    }
    return (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6h8M8 10h8M8 14h5"/>
      <rect x="5" y="4" width="14" height="16" rx="2"/>
    </svg>);
}
export function ComposerContextChips({ refs, images, lang, workspacePath, supportsVision, disabled = false, onRefsChange, onImagesChange, children, }: ComposerContextChipsProps) {
    const [dragOver, setDragOver] = useState(false);
    const hasAttachments = refs.length > 0 || images.length > 0;
    const showVisionWarning = images.length > 0 && !supportsVision;
    async function ingestDataTransfer(dataTransfer: DataTransfer) {
        if (disabled)
            return;
        const entry = readDraggedChatEntry(dataTransfer);
        if (entry) {
            onRefsChange(mergeContextRefs(refs, entry));
            return;
        }
        const droppedRefs = readDroppedWorkspaceRefs(dataTransfer, workspacePath);
        if (droppedRefs.length) {
            let next = [...refs];
            for (const ref of droppedRefs) {
                next = mergeContextRefs(next, ref);
            }
            onRefsChange(next);
        }
        const droppedImages = await readDroppedImageFiles(dataTransfer);
        if (droppedImages.length) {
            onImagesChange(mergeChatImages(images, droppedImages));
        }
    }
    function handleDragOver(event: React.DragEvent) {
        if (disabled)
            return;
        const types = [...event.dataTransfer.types];
        const canDrop = types.includes(CHAT_ENTRY_DRAG_MIME) ||
            types.includes("Files") ||
            types.includes("application/x-moz-file");
        if (!canDrop)
            return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragOver(true);
    }
    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setDragOver(false);
        void ingestDataTransfer(event.dataTransfer);
    }
    return (<div className={`composer-context-zone${hasAttachments ? " composer-context-zone--has-refs" : ""}${dragOver ? " composer-context-zone--drag-over" : ""}`} onDragOver={handleDragOver} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
      {showVisionWarning ? (<p className="composer-context__warning" role="status">
          {t(lang, "composerVisionUnsupported")}
        </p>) : null}
      {hasAttachments ? (<div className={`composer-context${dragOver ? " composer-context--drag-over" : ""} composer-context--has-refs`}>
          {refs.map((ref) => (<span key={ref.path} className="composer-context__chip" title={ref.path}>
              <span className="composer-context__chip-icon">
                <ContextChipIcon kind={ref.kind}/>
              </span>
              <span className="composer-context__chip-label">{ref.name}</span>
              {!disabled ? (<button type="button" className="composer-context__chip-remove" onClick={() => onRefsChange(refs.filter((item) => item.path !== ref.path))} aria-label={t(lang, "removeContextRef", ref.name)}>
                  ×
                </button>) : null}
            </span>))}
          {images.map((image) => (<span key={image.id} className="composer-context__chip composer-context__chip--image" title={image.name}>
              <img className="composer-context__chip-thumb" src={image.dataUrl} alt={image.name}/>
              <span className="composer-context__chip-label">{image.name}</span>
              {!disabled ? (<button type="button" className="composer-context__chip-remove" onClick={() => onImagesChange(images.filter((item) => item.id !== image.id))} aria-label={t(lang, "removeImage", image.name)}>
                  ×
                </button>) : null}
            </span>))}
        </div>) : null}
      {children}
    </div>);
}
export function ChatContextChips({ refs, lang, }: {
    refs: ChatContextRef[];
    lang: UiLanguage;
}) {
    if (!refs.length)
        return null;
    return (<div className="chat-context-chips">
      {refs.map((ref) => (<span key={ref.path} className="composer-context__chip" title={ref.path}>
          <span className="composer-context__chip-icon">
            <ContextChipIcon kind={ref.kind}/>
          </span>
          <span className="composer-context__chip-label">{ref.name}</span>
        </span>))}
    </div>);
}
export async function handleComposerPaste(event: React.ClipboardEvent, images: ChatImage[], onImagesChange: (images: ChatImage[]) => void): Promise<boolean> {
    const pasted = await readClipboardImages(event.clipboardData);
    if (!pasted.length)
        return false;
    event.preventDefault();
    onImagesChange(mergeChatImages(images, pasted));
    return true;
}
