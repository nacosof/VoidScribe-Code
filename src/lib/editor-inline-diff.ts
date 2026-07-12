import { inlineDiffMarks } from "@/lib/line-diff";
import { StateEffect, StateField, type Extension, type Text, Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType, } from "@codemirror/view";
export type AgentDiffSnapshot = {
    baseline: string;
    after: string;
} | null;
export const setDiffSnapshot = StateEffect.define<AgentDiffSnapshot>();
export const setDiffBaseline = StateEffect.define<string | null>();
class DeletedLinesWidget extends WidgetType {
    constructor(readonly lines: string[]) {
        super();
    }
    eq(other: DeletedLinesWidget): boolean {
        return this.lines.join("\n") === other.lines.join("\n");
    }
    toDOM(): HTMLElement {
        const wrap = document.createElement("div");
        wrap.className = "cm-diff-deleted-block";
        for (const line of this.lines) {
            const row = document.createElement("div");
            row.className = "cm-diff-deleted-line";
            row.textContent = line.length ? line : " ";
            wrap.appendChild(row);
        }
        return wrap;
    }
    ignoreEvent(): boolean {
        return true;
    }
}
function normalizeDiffText(text: string): string {
    return text.replace(/\r\n/g, "\n");
}
function buildDiffDecorations(doc: Text, baseline: string | null, afterText?: string | null): DecorationSet {
    if (baseline === null) {
        return Decoration.none;
    }
    const docText = normalizeDiffText(afterText ?? doc.toString());
    const beforeText = normalizeDiffText(baseline);
    if (beforeText === docText) {
        return Decoration.none;
    }
    const marks = inlineDiffMarks(beforeText, docText);
    const decorations: Range<Decoration>[] = [];
    for (const mark of marks) {
        if (mark.kind === "insert") {
            if (mark.line < 1 || mark.line > doc.lines)
                continue;
            decorations.push(Decoration.line({ class: "cm-diff-insert" }).range(doc.line(mark.line).from));
            continue;
        }
        const pos = mark.afterLine <= 0
            ? 0
            : doc.line(Math.min(mark.afterLine, doc.lines)).to;
        decorations.push(Decoration.widget({
            widget: new DeletedLinesWidget(mark.lines),
            block: true,
            side: -1,
        }).range(pos));
    }
    return Decoration.set(decorations, true);
}
type DiffFieldState = {
    snapshot: AgentDiffSnapshot;
    decorations: DecorationSet;
};
const agentDiffField = StateField.define<DiffFieldState>({
    create() {
        return { snapshot: null, decorations: Decoration.none };
    },
    update(value, tr) {
        let snapshot = value.snapshot;
        for (const effect of tr.effects) {
            if (effect.is(setDiffSnapshot)) {
                snapshot = effect.value;
                continue;
            }
            if (effect.is(setDiffBaseline)) {
                snapshot =
                    effect.value === null
                        ? null
                        : { baseline: effect.value, after: tr.newDoc.toString() };
            }
        }
        if (!snapshot) {
            return { snapshot: null, decorations: Decoration.none };
        }
        if (tr.docChanged ||
            snapshot.baseline !== value.snapshot?.baseline ||
            snapshot.after !== value.snapshot?.after) {
            return {
                snapshot,
                decorations: buildDiffDecorations(tr.newDoc, snapshot.baseline, snapshot.after),
            };
        }
        return value;
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});
export const agentInlineDiffTheme = EditorView.baseTheme({
    ".cm-line.cm-diff-insert": {
        backgroundColor: "rgba(46, 160, 67, 0.20) !important",
    },
    ".cm-activeLine.cm-diff-insert": {
        backgroundColor: "rgba(46, 160, 67, 0.26) !important",
    },
    ".cm-diff-deleted-block": {
        backgroundColor: "rgba(248, 81, 73, 0.16)",
        borderLeft: "3px solid rgba(248, 81, 73, 0.55)",
        margin: "0",
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
    },
    ".cm-diff-deleted-line": {
        color: "rgba(220, 170, 168, 0.92)",
        textDecoration: "line-through",
        opacity: 0.92,
        padding: "0 2px",
        whiteSpace: "pre",
    },
});
export function createAgentInlineDiffExtension(): Extension[] {
    return [agentDiffField, agentInlineDiffTheme];
}
