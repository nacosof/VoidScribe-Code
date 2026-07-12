import type { Extension } from "@codemirror/state";
import { linter, lintGutter } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { Diagnostic } from "@codemirror/lint";
import type { LintDiagnostic } from "@/types";

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

export function getEditorLintExtensions(filePath: string): Extension[] {
  return [
    lintGutter(),
    linter(async (view) => {
      if (!window.voidscribe?.lintWorkspaceFile) return [];

      const content = view.state.doc.toString();
      const result = await window.voidscribe.lintWorkspaceFile(filePath, content);
      if (!result.ok) return [];

      return result.diagnostics.map((item) =>
        toCodeMirrorDiagnostic(view.state.doc, item)
      );
    }, { delay: 600 }),
  ];
}
