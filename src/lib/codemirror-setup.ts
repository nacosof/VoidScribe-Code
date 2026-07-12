import { history, defaultKeymap } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { kotlin, scala as scalaModeDef, dart as dartMode } from "@codemirror/legacy-modes/mode/clike";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { go } from "@codemirror/legacy-modes/mode/go";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { r as rLang } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { vb } from "@codemirror/legacy-modes/mode/vb";
import type { Extension } from "@codemirror/state";
import { EditorState, Prec } from "@codemirror/state";
import { autocompletion, completeAnyWord } from "@codemirror/autocomplete";
import { HighlightStyle, syntaxHighlighting, foldGutter } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { keymap, scrollPastEnd } from "@codemirror/view";
import { EditorView } from "@codemirror/view";
import { getHighlightMode, type HighlightMode } from "./language-registry";
export const voidscribeEditorTheme = EditorView.theme({
    "&": {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: "0",
        backgroundColor: "var(--abyss-gray, #0b0d13)",
        color: "#d8dee9",
        fontSize: "16px",
    },
    ".cm-scroller": {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        lineHeight: "1.4667",
        overflow: "auto",
        minHeight: "0",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--scrollbar-thumb) transparent",
    },
    ".cm-content": {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: "16px",
        lineHeight: "1.4667",
        caretColor: "#e6e9f0",
    },
    ".cm-scroller::-webkit-scrollbar": {
        width: "8px",
        height: "8px",
    },
    ".cm-scroller::-webkit-scrollbar-track": {
        background: "transparent",
    },
    ".cm-scroller::-webkit-scrollbar-thumb": {
        background: "var(--scrollbar-thumb)",
        borderRadius: "999px",
        border: "2px solid transparent",
        backgroundClip: "padding-box",
    },
    ".cm-scroller::-webkit-scrollbar-thumb:hover": {
        background: "var(--scrollbar-thumb-hover)",
        backgroundClip: "padding-box",
    },
    ".cm-gutters": {
        backgroundColor: "var(--abyss-gray, #0b0d13)",
        color: "rgba(140, 148, 165, 0.72)",
        border: "none",
        paddingLeft: "17px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "1.5em",
        padding: "0",
        textAlign: "right",
    },
    ".cm-foldGutter .cm-gutterElement": {
        width: "14px",
        padding: "0",
    },
    ".cm-foldGutter span": {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "14px",
        fontSize: "14px",
        lineHeight: "1",
        color: "rgba(190, 198, 214, 0.95)",
        cursor: "pointer",
    },
    ".cm-foldGutter span:hover": {
        color: "#e6e9f0",
    },
    ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "rgba(200, 206, 220, 0.9)",
    },
    ".cm-activeLine": {
        backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "#e6e9f0",
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: "rgba(120, 140, 180, 0.16) !important",
    },
    ".cm-selectionMatch": {
        backgroundColor: "rgba(120, 140, 180, 0.12) !important",
    },
    ".cm-line": {
        padding: "0 2px",
    },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        outline: "1px solid rgba(255, 255, 255, 0.18)",
    },
    ".cm-lintRange-error": {
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L2 0 L4 3 Z' fill='%23f14c4c'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "left bottom",
    },
    ".cm-lintRange-warning": {
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L2 0 L4 3 Z' fill='%23d4b06a'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "left bottom",
    },
    ".cm-lint-marker-error": {
        content: '"!"',
        color: "#f14c4c",
    },
    ".cm-lint-marker-warning": {
        color: "#d4b06a",
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
        backgroundColor: "var(--panel-bg, #12151c)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "6px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
        color: "#d8dee9",
        "& > ul > li[aria-selected]": {
            background: "rgba(90, 120, 180, 0.55)",
            color: "#fff",
        },
    },
    ".cm-tooltip.cm-completionInfo": {
        backgroundColor: "var(--panel-bg, #12151c)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "6px",
        color: "#abb2bf",
        padding: "6px 8px",
        maxWidth: "420px",
    },
    ".cm-completionMatchedText": {
        textDecoration: "underline",
        color: "#8fb4d8",
    },
    ".cm-completionDetail": {
        color: "rgba(140, 148, 165, 0.9)",
        fontStyle: "italic",
    },
}, { dark: true });
const editorSelectionFix = Prec.highest(EditorView.theme({
    ".cm-line::selection, .cm-line ::selection": {
        backgroundColor: "transparent !important",
    },
    ".cm-content :focus::selection, .cm-content :focus ::selection": {
        backgroundColor: "transparent !important",
    },
}));
const voidscribeHighlightStyle = HighlightStyle.define([
    { tag: [t.comment, t.lineComment, t.blockComment], color: "#5c6370", fontStyle: "italic" },
    { tag: [t.meta, t.documentMeta], color: "#5c6370" },
    { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "#c4a7e7" },
    { tag: [t.tagName], color: "#8fb4d8" },
    { tag: [t.angleBracket], color: "#8fb4d8" },
    { tag: [t.string, t.special(t.string), t.inserted, t.content], color: "#a3be8c" },
    { tag: [t.attributeValue], color: "#a3be8c" },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#8fb4d8" },
    { tag: [t.propertyName], color: "#e6e9f0" },
    { tag: [t.attributeName], color: "#e5c07b" },
    { tag: [t.typeName, t.className, t.namespace], color: "#e5c07b" },
    { tag: [t.definition(t.typeName)], color: "#e5c07b" },
    { tag: [t.number, t.bool, t.atom, t.literal], color: "#d19a66" },
    { tag: [t.variableName, t.definition(t.variableName)], color: "#e6e9f0" },
    { tag: [t.name, t.labelName], color: "#e6e9f0" },
    {
        tag: [
            t.operator,
            t.punctuation,
            t.bracket,
            t.squareBracket,
            t.paren,
            t.brace,
            t.separator,
            t.derefOperator,
        ],
        color: "#abb2bf",
    },
    { tag: [t.regexp, t.escape, t.url], color: "#8fb4d8" },
    { tag: t.heading, fontWeight: "bold", color: "#c4a7e7" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, color: "#8fb4d8", textDecoration: "underline" },
    { tag: t.invalid, color: "#e5c07b" },
    { tag: t.processingInstruction, color: "#8fb4d8" },
]);
const documentWordCompletion = EditorState.languageData.of(() => [
    { autocomplete: completeAnyWord },
]);
export const voidscribeCodeTheme: Extension[] = [
    voidscribeEditorTheme,
    editorSelectionFix,
    syntaxHighlighting(voidscribeHighlightStyle),
    foldGutter({ openText: "▾", closedText: "▸" }),
    documentWordCompletion,
    autocompletion({
        activateOnTyping: true,
        defaultKeymap: true,
        icons: true,
        maxRenderedOptions: 30,
    }),
    scrollPastEnd(),
    Prec.high(keymap.of(defaultKeymap)),
];
const kotlinHighlight = StreamLanguage.define(kotlin);
const scalaHighlight = StreamLanguage.define(scalaModeDef);
const fsharpMode = StreamLanguage.define(vb);
const HIGHLIGHT_BY_MODE: Record<HighlightMode, Extension | null> = {
    javascript: javascript(),
    typescript: javascript({ typescript: true }),
    jsx: javascript({ jsx: true }),
    tsx: javascript({ jsx: true, typescript: true }),
    json: json(),
    css: css(),
    html: html(),
    markdown: markdown(),
    python: python(),
    rust: rust(),
    cpp: cpp(),
    java: java(),
    csharp: java(),
    sql: sql(),
    yaml: yaml(),
    dart: StreamLanguage.define(dartMode),
    go: StreamLanguage.define(go),
    php: java(),
    ruby: StreamLanguage.define(ruby),
    kotlin: kotlinHighlight,
    swift: StreamLanguage.define(swift),
    lua: StreamLanguage.define(lua),
    scala: scalaHighlight,
    shell: StreamLanguage.define(shell),
    perl: StreamLanguage.define(perl),
    zig: rust(),
    r: StreamLanguage.define(rLang),
    dockerfile: StreamLanguage.define(dockerFile),
    graphql: javascript({ typescript: true }),
    toml: StreamLanguage.define(toml),
    haskell: StreamLanguage.define(haskell),
    clojure: StreamLanguage.define(clojure),
    erlang: StreamLanguage.define(erlang),
    elixir: StreamLanguage.define(ruby),
    fsharp: fsharpMode,
    objectivec: cpp(),
    powershell: StreamLanguage.define(powerShell),
    vue: html(),
    svelte: html(),
    plaintext: null,
};
export function getCodeMirrorExtensions(filePath: string): Extension[] {
    const mode = getHighlightMode(filePath);
    const highlight = HIGHLIGHT_BY_MODE[mode];
    return highlight ? [highlight] : [];
}
export function createEditorSaveKeymap(input: {
    onSave: (content: string) => void;
    onSaveAs?: (content: string) => void;
}): Extension {
    return Prec.highest(keymap.of([
        {
            key: "Mod-s",
            preventDefault: true,
            run: (view: EditorView) => {
                input.onSave(view.state.doc.toString());
                return true;
            },
        },
        ...(input.onSaveAs
            ? [
                {
                    key: "Mod-Shift-s",
                    preventDefault: true,
                    run: (view: EditorView) => {
                        input.onSaveAs?.(view.state.doc.toString());
                        return true;
                    },
                },
            ]
            : []),
    ]));
}
export const editorHistory = history();
