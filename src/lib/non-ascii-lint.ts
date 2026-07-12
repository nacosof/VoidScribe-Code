import type { LintDiagnostic } from "@/types";
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const IDENTIFIER_TOKEN_RE = /[A-Za-z_\u0400-\u04FF][\w\u0400-\u04FF]*/g;
const NON_ASCII_LINT_STRATEGIES = new Set([
    "python",
    "javascript",
    "java",
    "kotlin",
    "dart",
    "go",
    "rust",
    "c",
    "cpp",
    "csharp",
    "swift",
    "scala",
    "php",
    "ruby",
    "lua",
    "perl",
    "zig",
    "shell",
    "powershell",
    "objectivec",
    "fsharp",
    "haskell",
    "elixir",
    "r",
    "vue",
]);
export function shouldLintNonAsciiIdentifiers(lintStrategy: string | null): boolean {
    return lintStrategy !== null && NON_ASCII_LINT_STRATEGIES.has(lintStrategy);
}
function stripPythonComment(line: string): string {
    let inSingle = false;
    let inDouble = false;
    let inTriple: "'" | '"' | null = null;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]!;
        const next2 = line.slice(i, i + 3);
        if (inTriple) {
            if (next2 === inTriple.repeat(3)) {
                inTriple = null;
                i += 2;
            }
            continue;
        }
        if (!inSingle && !inDouble) {
            if (next2 === "'''" || next2 === '"""') {
                inTriple = next2[0] as "'" | '"';
                i += 2;
                continue;
            }
            if (ch === "#")
                return line.slice(0, i);
        }
        if (!inDouble && ch === "'" && line[i - 1] !== "\\")
            inSingle = !inSingle;
        if (!inSingle && ch === '"' && line[i - 1] !== "\\")
            inDouble = !inDouble;
    }
    return line;
}
function stripJsLikeComment(line: string): string {
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inLineComment = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]!;
        const next = line[i + 1];
        if (inLineComment)
            return line.slice(0, i);
        if (!inSingle && !inDouble && !inTemplate && ch === "/" && next === "/") {
            return line.slice(0, i);
        }
        if (!inSingle && !inDouble && !inTemplate && ch === "/" && next === "*") {
            const end = line.indexOf("*/", i + 2);
            return end === -1 ? line.slice(0, i) : line.slice(0, i) + line.slice(end + 2);
        }
        if (!inDouble && !inTemplate && ch === "'" && line[i - 1] !== "\\")
            inSingle = !inSingle;
        if (!inSingle && !inTemplate && ch === '"' && line[i - 1] !== "\\")
            inDouble = !inDouble;
        if (!inSingle && !inDouble && ch === "`" && line[i - 1] !== "\\")
            inTemplate = !inTemplate;
    }
    return line;
}
function stripLineForScan(line: string, lintStrategy: string | null): string {
    if (lintStrategy === "python")
        return stripPythonComment(line);
    if (lintStrategy === "shell" || lintStrategy === "powershell") {
        const hash = line.indexOf("#");
        return hash >= 0 ? line.slice(0, hash) : line;
    }
    return stripJsLikeComment(line);
}
function stripJsxTextFromLine(line: string): string {
    return line.replace(/>([^<{]*?)</g, "><");
}
function isJsxLikePath(filePath?: string): boolean {
    if (!filePath)
        return false;
    const lower = filePath.toLowerCase();
    return lower.endsWith(".tsx") || lower.endsWith(".jsx");
}
function isInsideStringLiteral(line: string, index: number): boolean {
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    for (let i = 0; i < index; i += 1) {
        const ch = line[i]!;
        if (!inDouble && !inTemplate && ch === "'" && line[i - 1] !== "\\")
            inSingle = !inSingle;
        if (!inSingle && !inTemplate && ch === '"' && line[i - 1] !== "\\")
            inDouble = !inDouble;
        if (!inSingle && !inDouble && ch === "`" && line[i - 1] !== "\\")
            inTemplate = !inTemplate;
    }
    return inSingle || inDouble || inTemplate;
}
export function lintNonAsciiIdentifiers(content: string, lintStrategy: string | null, filePath?: string): LintDiagnostic[] {
    if (!shouldLintNonAsciiIdentifiers(lintStrategy))
        return [];
    const diagnostics: LintDiagnostic[] = [];
    const isJsx = isJsxLikePath(filePath);
    const lines = content.split("\n");
    lines.forEach((line, lineIndex) => {
        let stripped = stripLineForScan(line, lintStrategy);
        if (isJsx && lintStrategy === "javascript") {
            stripped = stripJsxTextFromLine(stripped);
        }
        for (const match of stripped.matchAll(IDENTIFIER_TOKEN_RE)) {
            const text = match[0];
            const column = match.index ?? 0;
            if (!CYRILLIC_RE.test(text))
                continue;
            if (isInsideStringLiteral(stripped, column))
                continue;
            diagnostics.push({
                line: lineIndex + 1,
                column,
                endColumn: column + text.length,
                severity: "warning",
                message: "Кириллица в коде допустима только внутри строк (\"...\"). Имена переменных и функций пишите латиницей.",
            });
        }
    });
    return diagnostics;
}
