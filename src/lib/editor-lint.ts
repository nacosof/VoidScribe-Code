import type { Extension } from "@codemirror/state";
import { linter, lintGutter } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { Diagnostic } from "@codemirror/lint";
import type { LintDiagnostic } from "@/types";
import { getLintStrategy } from "@/lib/language-registry";
import { lintNonAsciiIdentifiers } from "@/lib/non-ascii-lint";
export function dedupeDiagnostics(items: LintDiagnostic[]): LintDiagnostic[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = `${item.line}:${item.column}:${item.endColumn}:${item.message}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function lineColToOffset(doc: Text, line: number, column: number): number {
    const safeLine = Math.max(1, Math.min(line, doc.lines));
    const lineInfo = doc.line(safeLine);
    return lineInfo.from + Math.max(0, Math.min(column, lineInfo.length));
}
function toCodeMirrorDiagnostic(doc: Text, item: LintDiagnostic): Diagnostic {
    const from = lineColToOffset(doc, item.line, item.column);
    const to = lineColToOffset(doc, item.line, item.endColumn);
    return {
        from,
        to: Math.max(to, from + 1),
        severity: item.severity,
        message: item.message,
    };
}
export function hasLintErrors(diagnostics: LintDiagnostic[]): boolean {
    return diagnostics.some((item) => item.severity === "error");
}

export async function lintFileContent(filePath: string, content: string, options?: { semantic?: boolean }): Promise<LintDiagnostic[]> {
    const strategy = getLintStrategy(filePath);
    const local = lintNonAsciiIdentifiers(content, strategy, filePath);
    if (!window.voidscribe?.lintWorkspaceFile) {
        return local;
    }
    const result = await window.voidscribe.lintWorkspaceFile(filePath, content, options);
    const remote = result.ok ? result.diagnostics : [];
    return dedupeDiagnostics([...local, ...remote]);
}

function wantsSemanticAnalysis(filePath: string): boolean {
    return /\.(tsx?|mts|cts|jsx?|mjs|cjs|py|pyw|pyi)$/i.test(filePath);
}

export function getEditorLintExtensions(filePath: string): Extension[] {
    const semantic = wantsSemanticAnalysis(filePath);
    return [
        lintGutter(),
        linter(async (view) => {
            const content = view.state.doc.toString();
            const merged = await lintFileContent(filePath, content, { semantic });
            return merged.map((item) => toCodeMirrorDiagnostic(view.state.doc, item));
        }, { delay: semantic ? 1200 : 450 }),
    ];
}
