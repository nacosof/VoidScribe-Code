import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export function editorSelectionText(view: EditorView): string {
    const sel = view.state.selection.main;
    if (sel.empty)
        return "";
    return view.state.sliceDoc(sel.from, sel.to);
}

export async function copyEditorSelection(view: EditorView): Promise<boolean> {
    const text = editorSelectionText(view);
    if (!text)
        return false;
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch {
        return false;
    }
}

export async function pasteIntoEditor(view: EditorView): Promise<boolean> {
    try {
        const text = await navigator.clipboard.readText();
        if (!text)
            return false;
        view.dispatch(view.state.changeByRange((range) => ({
            changes: { from: range.from, to: range.to, insert: text },
            range: EditorSelection.cursor(range.from + text.length),
        })));
        view.focus();
        return true;
    }
    catch {
        return false;
    }
}
