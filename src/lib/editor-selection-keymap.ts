import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export type EditorSelectionActionHandlers = {
    onAddToChat: () => void;
    onQuickEdit: () => void;
};

const handlersRef: { current: EditorSelectionActionHandlers | null } = { current: null };

export function setEditorSelectionActionHandlers(handlers: EditorSelectionActionHandlers | null): void {
    handlersRef.current = handlers;
}

export function createEditorSelectionKeymap(): Extension {
    return Prec.highest(keymap.of([
        {
            key: "Mod-l",
            run: () => {
                handlersRef.current?.onAddToChat();
                return true;
            },
        },
        {
            key: "Mod-k",
            run: () => {
                handlersRef.current?.onQuickEdit();
                return true;
            },
        },
    ]));
}
