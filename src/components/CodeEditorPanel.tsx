import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { ExternalChange } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { createEditorSaveKeymap, editorHistory, getCodeMirrorExtensions, voidscribeCodeTheme, } from "@/lib/codemirror-setup";
import { createAgentInlineDiffExtension, setDiffSnapshot, } from "@/lib/editor-inline-diff";
import { getEditorLintExtensions } from "@/lib/editor-lint";
import { editorSearchExtension, editorSearchKeymap, } from "@/lib/editor-search-panel";
import {
    getEditorSelectionInfo,
    selectionToolbarCoords,
    type EditorSelectionInfo,
} from "@/lib/editor-selection";
import { createEditorSelectionKeymap, setEditorSelectionActionHandlers, } from "@/lib/editor-selection-keymap";
import { runQuickEditStream } from "@/lib/quick-edit";
import { EditorQuickEditPanel } from "@/components/EditorQuickEditPanel";
import { EditorSelectionToolbar } from "@/components/EditorSelectionToolbar";
import { EditorContextMenu, type EditorContextMenuState } from "@/components/EditorContextMenu";
import { copyEditorSelection, pasteIntoEditor } from "@/lib/editor-clipboard";
import type { EditorTab } from "@/hooks/useEditorTabs";
import { isEditorTabDirty } from "@/hooks/useEditorTabs";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type Props = {
    tab: EditorTab | null;
    lang: UiLanguage;
    aiReady?: boolean;
    agentDiffBaseline?: string | null;
    agentDiffAfter?: string | null;
    agentDiffActive?: boolean;
    onAgentDiffUndo?: () => void;
    onAgentDiffKeep?: () => void;
    onAddSelectionToChat?: (selection: EditorSelectionInfo) => void;
    onChange: (content: string) => void;
    onSave: (content: string) => void | Promise<boolean>;
    onRevert: () => void;
    onSaveAs: (content: string) => void;
    onRegisterGetContent?: (getter: () => string | null) => void;
};

const PARENT_SYNC_MS = 120;

function normalizeEditorText(text: string): string {
    return text.replace(/\r\n/g, "\n");
}

export function CodeEditorPanel({
    tab,
    lang,
    aiReady = false,
    agentDiffBaseline = null,
    agentDiffAfter = null,
    agentDiffActive = false,
    onAgentDiffUndo,
    onAgentDiffKeep,
    onAddSelectionToChat,
    onChange,
    onSave,
    onRevert,
    onSaveAs,
    onRegisterGetContent,
}: Props) {
    const viewRef = useRef<EditorView | null>(null);
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveAsRef = useRef(onSaveAs);
    const savedContentRef = useRef("");
    const savingRef = useRef(false);
    const quickEditAbortRef = useRef<AbortController | null>(null);
    const quickEditOpenRef = useRef(false);
    const quickEditSelectionRef = useRef<EditorSelectionInfo | null>(null);
    const pinnedOverlayRef = useRef<{ top: number; left: number } | null>(null);
    const dirtyFlagRef = useRef(false);
    const parentSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [dirty, setDirty] = useState(false);
    const [selectionInfo, setSelectionInfo] = useState<EditorSelectionInfo | null>(null);
    const [overlayAnchor, setOverlayAnchor] = useState<{ top: number; left: number } | null>(null);
    const [quickEditOpen, setQuickEditOpen] = useState(false);
    const [quickEditPrompt, setQuickEditPrompt] = useState("");
    const [quickEditLoading, setQuickEditLoading] = useState(false);
    const [quickEditError, setQuickEditError] = useState("");
    const [quickEditDiffActive, setQuickEditDiffActive] = useState(false);
    const [quickEditBaseline, setQuickEditBaseline] = useState<string | null>(null);
    const [quickEditAfter, setQuickEditAfter] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);

    onChangeRef.current = onChange;
    onSaveAsRef.current = onSaveAs;
    savedContentRef.current = tab?.savedContent ?? "";
    quickEditOpenRef.current = quickEditOpen;

    const flushParentContent = useCallback((content: string) => {
        if (parentSyncTimerRef.current) {
            clearTimeout(parentSyncTimerRef.current);
            parentSyncTimerRef.current = null;
        }
        onChangeRef.current(content);
    }, []);

    const scheduleParentContent = useCallback((content: string) => {
        if (parentSyncTimerRef.current)
            clearTimeout(parentSyncTimerRef.current);
        parentSyncTimerRef.current = setTimeout(() => {
            parentSyncTimerRef.current = null;
            onChangeRef.current(content);
        }, PARENT_SYNC_MS);
    }, []);

    const updateDirtyIfNeeded = useCallback((content: string) => {
        const isDirty = normalizeEditorText(content) !== normalizeEditorText(savedContentRef.current);
        if (isDirty === dirtyFlagRef.current)
            return;
        dirtyFlagRef.current = isDirty;
        setDirty(isDirty);
    }, []);

    const pinOverlayFromView = useCallback((view: EditorView): { top: number; left: number } | null => {
        const body = bodyRef.current;
        if (!body)
            return null;
        const coords = selectionToolbarCoords(view, body);
        if (coords) {
            pinnedOverlayRef.current = coords;
            setOverlayAnchor(coords);
        }
        return coords;
    }, []);

    const syncSelectionUi = useCallback((view: EditorView) => {
        if (quickEditOpenRef.current)
            return;
        const path = tab?.path ?? "";
        const info = path ? getEditorSelectionInfo(view, path) : null;
        setSelectionInfo(info);
        if (!info) {
            pinnedOverlayRef.current = null;
            setOverlayAnchor(null);
            return;
        }
        pinOverlayFromView(view);
    }, [pinOverlayFromView, tab?.path]);

    const syncSelectionUiRef = useRef(syncSelectionUi);
    syncSelectionUiRef.current = syncSelectionUi;

    const markSaved = useCallback((content: string) => {
        const normalized = normalizeEditorText(content);
        savedContentRef.current = normalized;
        dirtyFlagRef.current = false;
        setDirty(false);
    }, []);

    const runSave = useCallback(async (content: string) => {
        if (savingRef.current || tab?.saving)
            return false;
        savingRef.current = true;
        try {
            const normalized = normalizeEditorText(content);
            flushParentContent(normalized);
            const result = onSave(normalized);
            const ok = result instanceof Promise ? await result : Boolean(result);
            if (ok) {
                markSaved(normalized);
                const view = viewRef.current;
                if (view && view.state.doc.toString() !== normalized) {
                    view.dispatch({
                        changes: { from: 0, to: view.state.doc.length, insert: normalized },
                        annotations: [ExternalChange.of(true)],
                    });
                }
            }
            return ok;
        }
        finally {
            savingRef.current = false;
        }
    }, [flushParentContent, markSaved, onSave, tab?.saving]);

    const getContent = useCallback(() => {
        const raw = viewRef.current?.state.doc.toString() ?? tab?.content ?? "";
        return normalizeEditorText(raw);
    }, [tab?.content]);

    const runSaveRef = useRef(runSave);
    runSaveRef.current = runSave;

    const clearQuickEditDiff = useCallback(() => {
        setQuickEditDiffActive(false);
        setQuickEditBaseline(null);
        setQuickEditAfter(null);
        const view = viewRef.current;
        if (view)
            view.dispatch({ effects: setDiffSnapshot.of(null) });
    }, []);

    const closeQuickEdit = useCallback(() => {
        quickEditAbortRef.current?.abort();
        quickEditAbortRef.current = null;
        quickEditOpenRef.current = false;
        quickEditSelectionRef.current = null;
        pinnedOverlayRef.current = null;
        setQuickEditOpen(false);
        setQuickEditPrompt("");
        setQuickEditLoading(false);
        setQuickEditError("");
        const view = viewRef.current;
        if (view)
            syncSelectionUiRef.current(view);
    }, []);

    const handleAddToChat = useCallback(() => {
        const view = viewRef.current;
        const path = tab?.path ?? "";
        if (!view || !path)
            return;
        const info = getEditorSelectionInfo(view, path);
        if (!info)
            return;
        onAddSelectionToChat?.(info);
        closeQuickEdit();
    }, [closeQuickEdit, onAddSelectionToChat, tab?.path]);

    const openQuickEdit = useCallback(() => {
        const view = viewRef.current;
        const path = tab?.path ?? "";
        if (!view || !path)
            return;
        const info = getEditorSelectionInfo(view, path);
        if (!info)
            return;
        quickEditSelectionRef.current = info;
        pinOverlayFromView(view);
        quickEditOpenRef.current = true;
        setSelectionInfo(info);
        setQuickEditError(aiReady ? "" : t(lang, "addKeyInSettings"));
        setQuickEditPrompt("");
        setQuickEditOpen(true);
    }, [aiReady, lang, pinOverlayFromView, tab?.path]);

    const submitQuickEdit = useCallback(async () => {
        const view = viewRef.current;
        const info = quickEditSelectionRef.current;
        if (!view || !info || !quickEditPrompt.trim() || quickEditLoading)
            return;
        setQuickEditLoading(true);
        setQuickEditError("");
        const controller = new AbortController();
        quickEditAbortRef.current = controller;
        const baseline = normalizeEditorText(view.state.doc.toString());
        try {
            const replacement = await runQuickEditStream({
                selection: info,
                instruction: quickEditPrompt,
                lang,
                signal: controller.signal,
            });
            if (controller.signal.aborted)
                return;
            const afterDoc = baseline.slice(0, info.from) + replacement + baseline.slice(info.to);
            view.dispatch({
                changes: { from: info.from, to: info.to, insert: replacement },
            });
            const normalizedAfter = normalizeEditorText(afterDoc);
            flushParentContent(normalizedAfter);
            updateDirtyIfNeeded(normalizedAfter);
            setQuickEditBaseline(baseline);
            setQuickEditAfter(normalizedAfter);
            setQuickEditDiffActive(true);
            view.dispatch({
                effects: setDiffSnapshot.of({ baseline, after: normalizedAfter }),
            });
            closeQuickEdit();
        }
        catch (err) {
            if (controller.signal.aborted)
                return;
            const raw = err instanceof Error ? err.message : String(err);
            const message = raw === "cancelled"
                ? t(lang, "chatRequestCancelled")
                : raw === "thinking_leak" || raw === "empty"
                    ? t(lang, "editorQuickEditBadResponse")
                    : raw;
            setQuickEditError(message);
        }
        finally {
            if (quickEditAbortRef.current === controller)
                quickEditAbortRef.current = null;
            setQuickEditLoading(false);
        }
    }, [closeQuickEdit, flushParentContent, lang, quickEditLoading, quickEditPrompt, updateDirtyIfNeeded]);

    const handleQuickEditUndo = useCallback(() => {
        const view = viewRef.current;
        if (!view || quickEditBaseline === null)
            return;
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: quickEditBaseline },
            annotations: [ExternalChange.of(true)],
        });
        flushParentContent(quickEditBaseline);
        updateDirtyIfNeeded(quickEditBaseline);
        clearQuickEditDiff();
    }, [clearQuickEditDiff, flushParentContent, quickEditBaseline, updateDirtyIfNeeded]);

    const handleQuickEditKeep = useCallback(() => {
        clearQuickEditDiff();
    }, [clearQuickEditDiff]);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleEditorCopy = useCallback(() => {
        const view = viewRef.current;
        if (!view)
            return;
        void copyEditorSelection(view);
    }, []);

    const handleEditorPaste = useCallback(async () => {
        const view = viewRef.current;
        if (!view)
            return;
        const ok = await pasteIntoEditor(view);
        if (ok) {
            const value = normalizeEditorText(view.state.doc.toString());
            flushParentContent(value);
            updateDirtyIfNeeded(value);
        }
    }, [flushParentContent, updateDirtyIfNeeded]);

    useEffect(() => {
        setEditorSelectionActionHandlers({ onAddToChat: handleAddToChat, onQuickEdit: openQuickEdit });
        return () => setEditorSelectionActionHandlers(null);
    }, [handleAddToChat, openQuickEdit]);

    const captureView = useMemo(() => EditorView.updateListener.of((update) => {
        viewRef.current = update.view;
        if (update.selectionSet || update.focusChanged || update.geometryChanged) {
            syncSelectionUiRef.current(update.view);
        }
        if (update.docChanged &&
            !update.transactions.some((tr) => tr.annotation(ExternalChange))) {
            const value = normalizeEditorText(update.state.doc.toString());
            scheduleParentContent(value);
            updateDirtyIfNeeded(value);
        }
    }), [scheduleParentContent, updateDirtyIfNeeded]);

    const blurHandler = useMemo(() => EditorView.domEventHandlers({
        blur: (_event, view) => {
            const value = normalizeEditorText(view.state.doc.toString());
            flushParentContent(value);
            updateDirtyIfNeeded(value);
            return false;
        },
    }), [flushParentContent, updateDirtyIfNeeded]);

    const contextMenuHandler = useMemo(() => EditorView.domEventHandlers({
        contextmenu: (event, view) => {
            event.preventDefault();
            const sel = view.state.selection.main;
            const canCopy = !sel.empty && Boolean(view.state.sliceDoc(sel.from, sel.to).trim());
            const menuWidth = 140;
            const menuHeight = 72;
            const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
            const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
            setContextMenu({ x, y, canCopy });
            view.focus();
            return true;
        },
    }), []);

    const saveKeymap = useMemo(() => createEditorSaveKeymap({
        onSave: (content) => {
            void runSaveRef.current(content);
        },
        onSaveAs: (content) => onSaveAsRef.current(normalizeEditorText(content)),
    }), []);

    const selectionKeymap = useMemo(() => createEditorSelectionKeymap(), []);

    const filePath = tab?.path ?? "";
    const extensions = useMemo(() => {
        if (!filePath)
            return voidscribeCodeTheme;
        return [
            editorHistory,
            captureView,
            blurHandler,
            contextMenuHandler,
            ...voidscribeCodeTheme,
            ...createAgentInlineDiffExtension(),
            editorSearchExtension,
            editorSearchKeymap,
            selectionKeymap,
            ...getCodeMirrorExtensions(filePath),
            ...getEditorLintExtensions(filePath),
            saveKeymap,
        ];
    }, [blurHandler, captureView, contextMenuHandler, filePath, saveKeymap, selectionKeymap]);

    const showAgentDiff = agentDiffActive && !quickEditDiffActive;
    const applyAgentDiff = useCallback((view: EditorView) => {
        if (!showAgentDiff) {
            if (!quickEditDiffActive)
                view.dispatch({ effects: setDiffSnapshot.of(null) });
            return;
        }
        const baseline = normalizeEditorText(agentDiffBaseline ?? "");
        const after = normalizeEditorText(agentDiffAfter ?? view.state.doc.toString());
        view.dispatch({
            effects: setDiffSnapshot.of({ baseline, after }),
        });
    }, [agentDiffAfter, agentDiffBaseline, quickEditDiffActive, showAgentDiff]);

    const applyAgentDiffRef = useRef(applyAgentDiff);
    applyAgentDiffRef.current = applyAgentDiff;

    useEffect(() => {
        if (!showAgentDiff || !agentDiffAfter || !tab)
            return;
        const normalizedAfter = normalizeEditorText(agentDiffAfter);
        const view = viewRef.current;
        const current = normalizeEditorText(view?.state.doc.toString() ?? tab.content);
        if (current === normalizedAfter || !view)
            return;
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: normalizedAfter },
            annotations: [ExternalChange.of(true)],
        });
    }, [showAgentDiff, agentDiffAfter, tab?.id, tab?.content, tab]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view)
            return;
        if (quickEditDiffActive && quickEditBaseline !== null && quickEditAfter !== null) {
            view.dispatch({
                effects: setDiffSnapshot.of({ baseline: quickEditBaseline, after: quickEditAfter }),
            });
            return;
        }
        applyAgentDiff(view);
    }, [applyAgentDiff, quickEditDiffActive, quickEditBaseline, quickEditAfter, tab?.id, tab?.content]);

    useEffect(() => {
        onRegisterGetContent?.(() => viewRef.current?.state.doc.toString() ?? null);
    }, [onRegisterGetContent, tab?.id]);

    useEffect(() => {
        if (!tab) {
            dirtyFlagRef.current = false;
            setDirty(false);
            setSelectionInfo(null);
            setOverlayAnchor(null);
            pinnedOverlayRef.current = null;
            closeQuickEdit();
            clearQuickEditDiff();
            return;
        }
        savedContentRef.current = tab.savedContent;
        const current = viewRef.current?.state.doc.toString() ?? tab.content;
        const normalizedCurrent = normalizeEditorText(current);
        const normalizedSaved = normalizeEditorText(tab.savedContent);
        if (normalizedCurrent === normalizedSaved) {
            markSaved(normalizedCurrent);
            return;
        }
        updateDirtyIfNeeded(current);
    }, [tab?.id, tab?.savedContent, tab?.content, updateDirtyIfNeeded, markSaved, tab, closeQuickEdit, clearQuickEditDiff]);

    useEffect(() => () => {
        quickEditAbortRef.current?.abort();
        if (parentSyncTimerRef.current)
            clearTimeout(parentSyncTimerRef.current);
    }, []);

    if (!tab) {
        return <div className="editor-workspace__empty">{t(lang, "editorEmpty")}</div>;
    }

    const tabDirty = dirty || isEditorTabDirty(tab);
    const showAgentDiffBar = showAgentDiff && onAgentDiffUndo && onAgentDiffKeep;
    const showQuickEditBar = quickEditDiffActive;
    const panelCoords = quickEditOpen
        ? (pinnedOverlayRef.current ?? overlayAnchor)
        : overlayAnchor;
    const showToolbar = Boolean(selectionInfo && panelCoords && !quickEditOpen);

    return (<section className="code-editor" aria-label="Editor">
      {showQuickEditBar ? (<header className="code-editor__header code-editor__header--diff">
          <span className="code-editor__path">{tab.path}</span>
          <span className="code-editor__diff-label">{t(lang, "editorQuickEditReview")}</span>
          <div className="code-editor__actions">
            <button type="button" className="btn btn--ghost code-editor__btn code-editor__btn--compact" onClick={handleQuickEditUndo}>
              {t(lang, "undoOne")}
            </button>
            <button type="button" className="btn btn--primary code-editor__btn code-editor__btn--compact" onClick={handleQuickEditKeep}>
              {t(lang, "keepOne")}
            </button>
          </div>
        </header>) : showAgentDiffBar ? (<header className="code-editor__header code-editor__header--diff">
          <span className="code-editor__path">{tab.path}</span>
          <span className="code-editor__diff-label">{t(lang, "agentDiffReview")}</span>
          <div className="code-editor__actions">
            <button type="button" className="btn btn--ghost code-editor__btn code-editor__btn--compact" onClick={onAgentDiffUndo}>
              {t(lang, "undoOne")}
            </button>
            <button type="button" className="btn btn--primary code-editor__btn code-editor__btn--compact" onClick={onAgentDiffKeep}>
              {t(lang, "keepOne")}
            </button>
          </div>
        </header>) : tabDirty ? (<header className="code-editor__header code-editor__header--dirty">
          <span className="code-editor__path">{tab.path}</span>
          <div className="code-editor__actions">
            <button type="button" className="btn btn--ghost code-editor__btn code-editor__btn--compact" onClick={onRevert}>
              {t(lang, "revert")}
            </button>
            <button type="button" className="btn btn--primary code-editor__btn code-editor__btn--compact" onClick={() => void runSave(getContent())} disabled={tab.saving}>
              {t(lang, "saveFile")}
            </button>
          </div>
        </header>) : null}

      {tab.error ? <p className="code-editor__error">{tab.error}</p> : null}

      <div ref={bodyRef} className="code-editor__body code-editor__body--cm">
        {showToolbar && panelCoords ? (
            <EditorSelectionToolbar
                lang={lang}
                top={panelCoords.top}
                left={panelCoords.left}
                onAddToChat={handleAddToChat}
                onQuickEdit={openQuickEdit}
            />
        ) : null}
        {quickEditOpen && panelCoords ? (
            <EditorQuickEditPanel
                lang={lang}
                top={panelCoords.top + 40}
                left={panelCoords.left}
                loading={quickEditLoading}
                value={quickEditPrompt}
                error={quickEditError || undefined}
                onChange={setQuickEditPrompt}
                onSubmit={() => void submitQuickEdit()}
                onCancel={closeQuickEdit}
            />
        ) : null}
        <CodeMirror key={tab.path} className="code-editor__cm" value={tab.content} height="100%" theme="none" extensions={extensions} onCreateEditor={(view) => {
            viewRef.current = view;
            applyAgentDiffRef.current(view);
            syncSelectionUiRef.current(view);
        }} basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: false,
            closeBrackets: false,
            indentOnInput: true,
            bracketMatching: true,
            syntaxHighlighting: false,
            highlightSelectionMatches: false,
            searchKeymap: false,
            history: false,
        }}/>
        {contextMenu ? (
            <EditorContextMenu
                menu={contextMenu}
                lang={lang}
                onCopy={handleEditorCopy}
                onPaste={handleEditorPaste}
                onClose={closeContextMenu}
            />
        ) : null}
      </div>
    </section>);
}
