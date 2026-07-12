import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import {
  createEditorSaveKeymap,
  getCodeMirrorExtensions,
  voidscribeCodeTheme,
} from "@/lib/codemirror-setup";
import { getEditorLintExtensions } from "@/lib/editor-lint";

type CodeEditorPanelProps = {
  filePath: string;
  content: string;
  error: string;
  onChange: (value: string) => void;
  onSave: (content: string) => void;
  onSaveAs?: () => void;
};

export function CodeEditorPanel({
  filePath,
  content,
  error,
  onChange,
  onSave,
  onSaveAs,
}: CodeEditorPanelProps) {
  const saveKeymap = useMemo(
    () => createEditorSaveKeymap({ onSave, onSaveAs }),
    [onSave, onSaveAs]
  );

  const extensions = useMemo(
    () => [
      ...voidscribeCodeTheme,
      ...getCodeMirrorExtensions(filePath),
      ...getEditorLintExtensions(filePath),
      saveKeymap,
    ],
    [filePath, saveKeymap]
  );

  return (
    <section className="code-editor" aria-label="Редактор кода">
      {error ? <p className="code-editor__error">{error}</p> : null}

      <div className="code-editor__body code-editor__body--cm">
        <CodeMirror
          key={filePath}
          className="code-editor__cm"
          value={content}
          height="100%"
          theme="none"
          extensions={extensions}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: false,
            indentOnInput: true,
            bracketMatching: true,
            syntaxHighlighting: false,
          }}
        />
      </div>
    </section>
  );
}
