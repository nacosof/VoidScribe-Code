import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { ExternalChange } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { createEditorSaveKeymap, editorHistory, getCodeMirrorExtensions, voidscribeCodeTheme, } from "@/lib/codemirror-setup";
import { createAgentInlineDiffExtension, setDiffSnapshot, } from "@/lib/editor-inline-diff";
import { getEditorLintExtensions } from "@/lib/editor-lint";
import { editorSearchExtension, editorSearchKeymap, } from "@/lib/editor-search-panel";
import type { EditorTab } from "@/hooks/useEditorTabs";
import { isEditorTabDirty } from "@/hooks/useEditorTabs";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";
type Props = {
    tab: EditorTab | null;
    lang: UiLanguage;
    agentDiffBaseline?: string | null;
    agentDiffAfter?: string | null;
    agentDiffActive?: boolean;
    onAgentDiffUndo?: () => void;
    onAgentDiffKeep?: () => void;
    onChange: (content: string) => void;
    onSave: (content: string) => void | Promise<boolean>;
    onRevert: () => void;
    onSaveAs: (content: string) => void;
    onRegisterGetContent?: (getter: () => string | null) => void;
};
function normalizeEditorText(text: string): string {
    return text.replace(/\r\n/g, "\n");
}
export function CodeEditorPanel({ tab, lang, agentDiffBaseline = null, agentDiffAfter = null, agentDiffActive = false, onAgentDiffUndo, onAgentDiffKeep, onChange, onSave, onRevert, onSaveAs, onRegisterGetContent, }: Props) {
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveAsRef = useRef(onSaveAs);
    const savedContentRef = useRef("");
    const savingRef = useRef(false);
    const [dirty, setDirty] = useState(false);
    onChangeRef.current = onChange;
    onSaveAsRef.current = onSaveAs;
    savedContentRef.current = tab?.savedContent ?? "";
    const syncDirty = useCallback((content: string) => {
        setDirty(normalizeEditorText(content) !==
            normalizeEditorText(savedContentRef.current));
    }, []);
    const markSaved = useCallback((content: string) => {
        const normalized = normalizeEditorText(content);
        savedContentRef.current = normalized;
        setDirty(false);
    }, []);
    const runSave = useCallback(async (content: string) => {
        if (savingRef.current || tab?.saving)
            return false;
        savingRef.current = true;
        try {
            const normalized = normalizeEditorText(content);
            onChangeRef.current(normalized);
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
    }, [markSaved, onSave, tab?.saving]);
    const getContent = useCallback(() => {
        const raw = viewRef.current?.state.doc.toString() ?? tab?.content ?? "";
        return normalizeEditorText(raw);
    }, [tab?.content]);
    const runSaveRef = useRef(runSave);
    runSaveRef.current = runSave;
    const captureView = useMemo(() => EditorView.updateListener.of((update) => {
        viewRef.current = update.view;
        if (update.docChanged &&
            !update.transactions.some((tr) => tr.annotation(ExternalChange))) {
            const value = normalizeEditorText(update.state.doc.toString());
            const saved = normalizeEditorText(savedContentRef.current);
            if (value !== saved) {
                onChangeRef.current(value);
            }
            syncDirty(value);
        }
    }), [syncDirty]);
    const saveKeymap = useMemo(() => createEditorSaveKeymap({
        onSave: (content) => {
            void runSaveRef.current(content);
        },
        onSaveAs: (content) => onSaveAsRef.current(normalizeEditorText(content)),
    }), []);
    const filePath = tab?.path ?? "";
    const extensions = useMemo(() => {
        if (!filePath)
            return voidscribeCodeTheme;
        return [
            editorHistory,
            captureView,
            ...voidscribeCodeTheme,
            ...createAgentInlineDiffExtension(),
            editorSearchExtension,
            editorSearchKeymap,
            ...getCodeMirrorExtensions(filePath),
            ...getEditorLintExtensions(filePath),
            saveKeymap,
        ];
    }, [filePath, captureView, saveKeymap]);
    const applyAgentDiff = useCallback((view: EditorView) => {
        if (!agentDiffActive) {
            view.dispatch({ effects: setDiffSnapshot.of(null) });
            return;
        }
        const baseline = normalizeEditorText(agentDiffBaseline ?? "");
        const after = normalizeEditorText(agentDiffAfter ?? view.state.doc.toString());
        view.dispatch({
            effects: setDiffSnapshot.of({ baseline, after }),
        });
    }, [agentDiffActive, agentDiffBaseline, agentDiffAfter]);
    const applyAgentDiffRef = useRef(applyAgentDiff);
    applyAgentDiffRef.current = applyAgentDiff;
    useEffect(() => {
        if (!agentDiffActive || !agentDiffAfter || !tab)
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
    }, [agentDiffActive, agentDiffAfter, tab?.id, tab?.content, tab]);
    useEffect(() => {
        const view = viewRef.current;
        if (!view)
            return;
        applyAgentDiff(view);
    }, [applyAgentDiff, tab?.id, tab?.content]);
    useEffect(() => {
        onRegisterGetContent?.(() => viewRef.current?.state.doc.toString() ?? null);
    }, [onRegisterGetContent, tab?.id]);
    useEffect(() => {
        if (!tab) {
            setDirty(false);
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
        syncDirty(current);
    }, [tab?.id, tab?.savedContent, tab?.content, syncDirty, markSaved, tab]);
    if (!tab) {
        return <div className="editor-workspace__empty">{t(lang, "editorEmpty")}</div>;
    }
    const tabDirty = dirty || isEditorTabDirty(tab);
    const showAgentDiffBar = agentDiffActive && onAgentDiffUndo && onAgentDiffKeep;
    return (<section className="code-editor" aria-label="Editor">
      {showAgentDiffBar ? (<header className="code-editor__header code-editor__header--diff">
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

      <div className="code-editor__body code-editor__body--cm">
        <CodeMirror key={tab.path} className="code-editor__cm" value={tab.content} height="100%" theme="none" extensions={extensions} onCreateEditor={(view) => {
            viewRef.current = view;
            applyAgentDiffRef.current(view);
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
      </div>
    </section>);
}
