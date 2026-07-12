import type { I18nKey } from "@/lib/i18n";
export type FileMenuItem = {
    id: string;
    label?: string;
    labelKey?: I18nKey;
    shortcut?: string;
    disabled?: boolean;
    checked?: boolean;
    separator?: boolean;
    submenu?: FileMenuItem[];
    onClick?: (arg?: string) => void;
    detail?: string;
};
export type FileMenuHandlers = {
    onOpenFile: () => void;
    onOpenFolder: () => void;
    onOpenRecent: (path: string) => void;
};
function modKey(shortcut: string): string {
    const isMac = typeof navigator !== "undefined" &&
        /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
    return shortcut.replace(/Ctrl/g, isMac ? "⌘" : "Ctrl");
}
export function buildTitleBarFileMenu(handlers: FileMenuHandlers): FileMenuItem[] {
    return [
        {
            id: "open-folder",
            labelKey: "fileMenuOpenFolder",
            shortcut: modKey("Ctrl+M Ctrl+O"),
            onClick: () => handlers.onOpenFolder(),
        },
        {
            id: "open-file",
            labelKey: "fileMenuOpenFile",
            shortcut: modKey("Ctrl+O"),
            onClick: () => handlers.onOpenFile(),
        },
        { id: "sep-recent", separator: true, label: "" },
        {
            id: "open-recent",
            labelKey: "fileMenuOpenRecent",
            submenu: [],
            onClick: (path) => {
                if (typeof path === "string")
                    handlers.onOpenRecent(path);
            },
        },
    ];
}
