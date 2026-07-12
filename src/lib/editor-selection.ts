import type { EditorView } from "@codemirror/view";
import type { UiLanguage } from "@/types";

export type EditorSelectionInfo = {
    path: string;
    startLine: number;
    endLine: number;
    text: string;
    from: number;
    to: number;
};

export function getEditorSelectionInfo(view: EditorView, filePath: string): EditorSelectionInfo | null {
    const main = view.state.selection.main;
    if (main.empty)
        return null;
    const text = view.state.sliceDoc(main.from, main.to);
    if (!text.trim())
        return null;
    return {
        path: filePath,
        startLine: view.state.doc.lineAt(main.from).number,
        endLine: view.state.doc.lineAt(main.to).number,
        text,
        from: main.from,
        to: main.to,
    };
}

export function formatSelectionForChat(selection: EditorSelectionInfo, lang: UiLanguage): string {
    const header = lang === "en"
        ? `[Selection from ${selection.path}, lines ${selection.startLine}-${selection.endLine}]`
        : `[Фрагмент из ${selection.path}, строки ${selection.startLine}-${selection.endLine}]`;
    return `${header}\n\n\`\`\`\n${selection.text}\n\`\`\``;
}

export function selectionToolbarCoords(view: EditorView, container: HTMLElement): {
    top: number;
    left: number;
} | null {
    const main = view.state.selection.main;
    if (main.empty)
        return null;
    const start = view.coordsAtPos(main.from);
    const end = view.coordsAtPos(main.to);
    if (!start || !end)
        return null;
    const rect = container.getBoundingClientRect();
    const top = Math.max(8, Math.min(start.top, end.top) - rect.top - 56);
    const left = Math.max(8, Math.min(start.left, end.left) - rect.left);
    return { top, left };
}
