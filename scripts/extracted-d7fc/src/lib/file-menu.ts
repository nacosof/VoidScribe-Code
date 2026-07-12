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
  onNewTextFile: () => void;
  onNewWindow: () => void;
  onNewAgentsWindow: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onOpenRecent: (path: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSaveAll: () => void;
  onToggleAutoSave: () => void;
  onPreferences: () => void;
  onRevertFile: () => void;
  onCloseEditor: () => void;
  onCloseFolder: () => void;
  onCloseWindow: () => void;
  onExit: () => void;
};

function modKey(shortcut: string): string {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  return shortcut.replace(/Ctrl/g, isMac ? "⌘" : "Ctrl");
}

export function buildAgentFileMenu(handlers: FileMenuHandlers): FileMenuItem[] {
  return [
    {
      id: "open-folder",
      labelKey: "fileMenuOpenFolder",
      onClick: () => handlers.onOpenFolder(),
    },
    {
      id: "open-file",
      labelKey: "fileMenuOpenFile",
      onClick: () => handlers.onOpenFile(),
    },
    { id: "sep-save", separator: true, label: "" },
    {
      id: "save-all",
      labelKey: "fileMenuSaveAll",
      shortcut: modKey("Ctrl+M S"),
      onClick: () => handlers.onSaveAll(),
    },
  ];
}

export function buildEditorFileMenu(
  handlers: FileMenuHandlers,
  options: { autoSave: boolean; hasActiveTab: boolean; hasWorkspace: boolean }
): FileMenuItem[] {
  return [
    {
      id: "new-text-file",
      labelKey: "fileMenuNewTextFile",
      shortcut: modKey("Ctrl+N"),
      disabled: !options.hasWorkspace,
      onClick: () => handlers.onNewTextFile(),
    },
    {
      id: "new-window",
      labelKey: "fileMenuNewWindow",
      shortcut: modKey("Ctrl+Shift+N"),
      onClick: () => handlers.onNewWindow(),
    },
    {
      id: "new-agents-window",
      labelKey: "fileMenuNewAgentsWindow",
      onClick: () => handlers.onNewAgentsWindow(),
    },
    {
      id: "new-window-profile",
      labelKey: "fileMenuNewWindowProfile",
      disabled: true,
    },
    { id: "sep-open", separator: true, label: "" },
    {
      id: "open-file",
      labelKey: "fileMenuOpenFile",
      shortcut: modKey("Ctrl+O"),
      onClick: () => handlers.onOpenFile(),
    },
    {
      id: "open-folder",
      labelKey: "fileMenuOpenFolder",
      shortcut: modKey("Ctrl+M Ctrl+O"),
      onClick: () => handlers.onOpenFolder(),
    },
    {
      id: "open-workspace-file",
      labelKey: "fileMenuOpenWorkspaceFile",
      disabled: true,
    },
    {
      id: "open-recent",
      labelKey: "fileMenuOpenRecent",
      submenu: [],
      onClick: (path) => {
        if (typeof path === "string") handlers.onOpenRecent(path);
      },
    },
    { id: "sep-workspace", separator: true, label: "" },
    {
      id: "add-folder",
      labelKey: "fileMenuAddFolder",
      disabled: true,
    },
    {
      id: "save-workspace",
      labelKey: "fileMenuSaveWorkspaceAs",
      disabled: true,
    },
    {
      id: "duplicate-workspace",
      labelKey: "fileMenuDuplicateWorkspace",
      disabled: true,
    },
    { id: "sep-save", separator: true, label: "" },
    {
      id: "save",
      labelKey: "fileMenuSave",
      shortcut: modKey("Ctrl+S"),
      disabled: !options.hasActiveTab,
      onClick: () => handlers.onSave(),
    },
    {
      id: "save-as",
      labelKey: "fileMenuSaveAs",
      shortcut: modKey("Ctrl+Shift+S"),
      disabled: !options.hasActiveTab,
      onClick: () => handlers.onSaveAs(),
    },
    {
      id: "save-all",
      labelKey: "fileMenuSaveAll",
      shortcut: modKey("Ctrl+M S"),
      onClick: () => handlers.onSaveAll(),
    },
    { id: "sep-share", separator: true, label: "" },
    {
      id: "share",
      labelKey: "fileMenuShare",
      disabled: true,
    },
    { id: "sep-prefs", separator: true, label: "" },
    {
      id: "auto-save",
      labelKey: "fileMenuAutoSave",
      checked: options.autoSave,
      onClick: () => handlers.onToggleAutoSave(),
    },
    {
      id: "preferences",
      labelKey: "fileMenuPreferences",
      onClick: () => handlers.onPreferences(),
    },
    { id: "sep-close", separator: true, label: "" },
    {
      id: "revert",
      labelKey: "fileMenuRevertFile",
      disabled: !options.hasActiveTab,
      onClick: () => handlers.onRevertFile(),
    },
    {
      id: "close-editor",
      labelKey: "fileMenuCloseEditor",
      shortcut: modKey("Ctrl+F4"),
      disabled: !options.hasActiveTab,
      onClick: () => handlers.onCloseEditor(),
    },
    {
      id: "close-folder",
      labelKey: "fileMenuCloseFolder",
      shortcut: modKey("Ctrl+M F"),
      disabled: !options.hasWorkspace,
      onClick: () => handlers.onCloseFolder(),
    },
    {
      id: "close-window",
      labelKey: "fileMenuCloseWindow",
      shortcut: "Alt+F4",
      onClick: () => handlers.onCloseWindow(),
    },
    { id: "sep-exit", separator: true, label: "" },
    {
      id: "exit",
      labelKey: "fileMenuExit",
      onClick: () => handlers.onExit(),
    },
  ];
}
