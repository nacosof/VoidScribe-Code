import { useCallback, useMemo, useState } from "react";
import { createId } from "@/lib/chat-sessions";

export type EditorTab = {
  id: string;
  path: string;
  content: string;
  savedContent: string;
  error: string;
  saving: boolean;
};

function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function useEditorTabs() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeId) ?? null,
    [tabs, activeId]
  );

  const activePath = activeTab?.path ?? null;
  const hasDirtyTabs = tabs.some((tab) => tab.content !== tab.savedContent);

  const updateTab = useCallback(
    (tabId: string, patch: Partial<EditorTab>) => {
      setTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab))
      );
    },
    []
  );

  const openFile = useCallback(async (relativePath: string) => {
    const existing = tabs.find((tab) => tab.path === relativePath);
    if (existing) {
      setActiveId(existing.id);
      return { ok: true as const };
    }

    const result = await window.voidscribe.readWorkspaceFile(relativePath);
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    const tab: EditorTab = {
      id: createId(),
      path: relativePath,
      content: result.content,
      savedContent: result.content,
      error: "",
      saving: false,
    };

    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    return { ok: true as const };
  }, [tabs]);

  const updateActiveContent = useCallback(
    (content: string) => {
      if (!activeId) return;
      updateTab(activeId, { content });
    },
    [activeId, updateTab]
  );

  const applyExternalContent = useCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.path === path
          ? { ...tab, content, savedContent: content, error: "" }
          : tab
      )
    );
  }, []);

  const reloadOpenPaths = useCallback(async (paths: string[]) => {
    const unique = [...new Set(paths)];
    for (const path of unique) {
      const result = await window.voidscribe.readWorkspaceFile(path);
      if (result.ok) {
        applyExternalContent(path, result.content);
      } else {
        setTabs((prev) => prev.filter((tab) => tab.path !== path));
      }
    }
  }, [applyExternalContent]);

  const saveTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab) return false;

      updateTab(tabId, { saving: true, error: "" });

      const result = await window.voidscribe.writeWorkspaceFile(
        tab.path,
        tab.content
      );

      if (!result.ok) {
        updateTab(tabId, { saving: false, error: result.error });
        return false;
      }

      updateTab(tabId, {
        saving: false,
        savedContent: tab.content,
        error: "",
      });
      return true;
    },
    [tabs, updateTab]
  );

  const saveActiveTab = useCallback(async () => {
    if (!activeId) return false;
    return saveTab(activeId);
  }, [activeId, saveTab]);

  const removeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === tabId);
      if (index < 0) return prev;

      const next = prev.filter((tab) => tab.id !== tabId);
      setActiveId((current) => {
        if (current !== tabId) return current;
        if (next.length === 0) return null;
        const nextIndex = Math.min(index, next.length - 1);
        return next[nextIndex]?.id ?? null;
      });
      return next;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveId(null);
  }, []);

  const isTabDirty = useCallback(
    (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId);
      return tab ? tab.content !== tab.savedContent : false;
    },
    [tabs]
  );

  return {
    tabs,
    activeId,
    activeTab,
    activePath,
    hasDirtyTabs,
    fileNameFromPath,
    setActiveId,
    openFile,
    updateActiveContent,
    applyExternalContent,
    reloadOpenPaths,
    saveTab,
    saveActiveTab,
    removeTab,
    closeAllTabs,
    isTabDirty,
  };
}
