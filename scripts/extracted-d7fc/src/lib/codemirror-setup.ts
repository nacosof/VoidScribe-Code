import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
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

export const voidscribeEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#0b0d13",
      color: "#e6e9f0",
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      lineHeight: "20px",
      scrollbarWidth: "thin",
      scrollbarColor: "rgba(126, 65, 180, 0.22) transparent",
    },
    ".cm-scroller::-webkit-scrollbar": {
      width: "8px",
      height: "8px",
    },
    ".cm-scroller::-webkit-scrollbar-track": {
      background: "transparent",
    },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      background: "rgba(126, 65, 180, 0.22)",
      borderRadius: "999px",
      border: "2px solid transparent",
      backgroundClip: "padding-box",
    },
    ".cm-scroller::-webkit-scrollbar-thumb:hover": {
      background: "rgba(126, 65, 180, 0.38)",
      backgroundClip: "padding-box",
    },
    ".cm-gutters": {
      backgroundColor: "#0b0d13",
      color: "rgba(140, 148, 165, 0.72)",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "rgba(200, 206, 220, 0.9)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(81, 44, 132, 0.08)",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#e6e9f0",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, &::selection":
      {
        backgroundColor: "rgba(81, 44, 132, 0.35) !important",
      },
    ".cm-line": {
      padding: "0 2px",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(81, 44, 132, 0.25)",
    },
  },
  { dark: true }
);

export function getCodeMirrorExtensions(filePath: string): Extension[] {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

  switch (ext) {
    case "py":
      return [python()];
    case "js":
    case "mjs":
    case "cjs":
      return [javascript()];
    case "jsx":
      return [javascript({ jsx: true })];
    case "ts":
      return [javascript({ typescript: true })];
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "json":
      return [json()];
    case "css":
    case "scss":
    case "less":
      return [css()];
    case "html":
    case "htm":
    case "xml":
    case "svg":
      return [html()];
    case "md":
    case "mdx":
      return [markdown()];
    case "rs":
      return [rust()];
    case "java":
      return [java()];
    case "sql":
      return [sql()];
    case "yml":
    case "yaml":
      return [yaml()];
    default:
      return [];
  }
}
