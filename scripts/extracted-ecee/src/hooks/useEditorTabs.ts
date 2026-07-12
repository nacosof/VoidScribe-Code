import { useCallback, useMemo, useRef, useState } from "react";
import { createId } from "@/lib/chat-sessions";

export type EditorTab = {
  id: string;
  path: string;
  content: string;
  savedContent: string;
  error: string;
  saving: boolean;
};

function normalizeTabPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function fileNameFromPath(path: string): string {
  const parts = normalizeTabPath(path).split("/");
  return parts[parts.length - 1] || path;
}

export function buildEditorTabTitle(
  path: string,
  allPaths: string[]
): string {
  const base = fileNameFromPath(path);
  const sameNameCount = allPaths.filter(
    (item) => fileNameFromPath(item) === base
  ).length;
  if (sameNameCount <= 1) return base;

  const norm = normalizeTabPath(path);
  const parts = norm.split("/");
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${base}`;
  }
  return norm;
}

export function useEditorTabs() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const openingPathsRef = useRef(new Map<string, Promise<{ ok: boolean }>>());

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
    const path = normalizeTabPath(relativePath);

    const inflight = openingPathsRef.current.get(path);
    if (inflight) {
      await inflight;
      let existingId: string | null = null;
      setTabs((prev) => {
        const existing = prev.find(
          (tab) => normalizeTabPath(tab.path) === path
        );
        if (existing) existingId = existing.id;
        return prev;
      });
      if (existingId) {
        setActiveId(existingId);
        return { ok: true as const };
      }
    }

    const task = (async () => {
      let existingId: string | null = null;
      setTabs((prev) => {
        const existing = prev.find(
          (tab) => normalizeTabPath(tab.path) === path
        );
        if (existing) existingId = existing.id;
        return prev;
      });

      if (existingId) {
        setActiveId(existingId);
        return { ok: true as const };
      }

      const result = await window.voidscribe.readWorkspaceFile(path);
      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }

      const tab: EditorTab = {
        id: createId(),
        path,
        content: result.content,
        savedContent: result.content,
        error: "",
        saving: false,
      };

      setTabs((prev) => {
        const existing = prev.find(
          (item) => normalizeTabPath(item.path) === path
        );
        if (existing) {
          setActiveId(existing.id);
          return prev;
        }
        return [...prev, tab];
      });
      setActiveId((current) => current ?? tab.id);
      setActiveId(tab.id);
      return { ok: true as const };
    })();

    openingPathsRef.current.set(path, task);
    try {
      return await task;
    } finally {
      openingPathsRef.current.delete(path);
    }
  }, []);

  const updateActiveContent = useCallback(
    (content: string) => {
      if (!activeId) return;
      updateTab(activeId, { content });
    },
    [activeId, updateTab]
  );

  const applyExternalContent = useCallback((path: string, content: string) => {
    const norm = normalizeTabPath(path);
    setTabs((prev) =>
      prev.map((tab) =>
        normalizeTabPath(tab.path) === norm
          ? { ...tab, content, savedContent: content, error: "" }
          : tab
      )
    );
  }, []);

  const reloadOpenPaths = useCallback(async (paths: string[]) => {
    const unique = [...new Set(paths.map(normalizeTabPath))];
    for (const path of unique) {
      const result = await window.voidscribe.readWorkspaceFile(path);
      if (result.ok) {
        applyExternalContent(path, result.content);
      } else {
        setTabs((prev) =>
          prev.filter((tab) => normalizeTabPath(tab.path) !== path)
        );
      }
    }
  }, [applyExternalContent]);

  const saveTab = useCallback(
    async (tabId: string, contentOverride?: string) => {
      let snapshot: { path: string; content: string } | null = null;

      setTabs((prev) => {
        const tab = prev.find((item) => item.id === tabId);
        if (!tab) return prev;
        snapshot = {
          path: tab.path,
          content: contentOverride ?? tab.content,
        };
        return prev.map((item) =>
          item.id === tabId ? { ...item, saving: true, error: "" } : item
        );
      });

      if (!snapshot) return false;
      const { path, content } = snapshot;

      const result = await window.voidscribe.writeWorkspaceFile(path, content);

      if (!result.ok) {
        updateTab(tabId, { saving: false, error: result.error });
        return false;
      }

      updateTab(tabId, {
        saving: false,
        savedContent: content,
        content,
        error: "",
      });
      return true;
    },
    [updateTab]
  );

  const saveActiveTab = useCallback(
    async (contentOverride?: string) => {
      if (!activeId) return false;
      return saveTab(activeId, contentOverride);
    },
    [activeId, saveTab]
  );

  const saveAllDirty = useCallback(async () => {
    let dirtyIds: string[] = [];
    setTabs((prev) => {
      dirtyIds = prev
        .filter((tab) => tab.content !== tab.savedContent)
        .map((tab) => tab.id);
      return prev;
    });

    for (const tabId of dirtyIds) {
      const ok = await saveTab(tabId);
      if (!ok) return false;
    }
    return true;
  }, [saveTab]);

  const revertActiveTab = useCallback(async () => {
    if (!activeId) return false;
    const tab = tabs.find((item) => item.id === activeId);
    if (!tab) return false;

    const result = await window.voidscribe.readWorkspaceFile(tab.path);
    if (!result.ok) {
      updateTab(activeId, { error: result.error });
      return false;
    }

    updateTab(activeId, {
      content: result.content,
      savedContent: result.content,
      error: "",
    });
    return true;
  }, [activeId, tabs, updateTab]);

  const saveActiveTabAs = useCallback(async () => {
    if (!activeId) return false;
    const tab = tabs.find((item) => item.id === activeId);
    if (!tab) return false;

    const picked = await window.voidscribe.pickSaveFileAs(tab.path);
    if (!picked.ok) return false;

    updateTab(activeId, { saving: true, error: "" });
    const result = await window.voidscribe.writeWorkspaceFile(
      picked.relativePath,
      tab.content
    );

    if (!result.ok) {
      updateTab(activeId, { saving: false, error: result.error });
      return false;
    }

    const oldPath = normalizeTabPath(tab.path);
    const newPath = normalizeTabPath(picked.relativePath);
    setTabs((prev) => {
      const next = prev.filter(
        (item) =>
          item.id === activeId ||
          normalizeTabPath(item.path) !== oldPath
      );
      return next.map((item) =>
        item.id === activeId
          ? {
              ...item,
              path: newPath,
              savedContent: item.content,
              saving: false,
              error: "",
            }
          : item
      );
    });
    return true;
  }, [activeId, tabs, updateTab]);

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

  const removeTabsForDeletedEntries = useCallback(
    (entries: Array<{ path: string; kind: "file" | "directory" }>) => {
      if (entries.length === 0) return;

      const norm = (value: string) => normalizeTabPath(value);
      const matches = (tabPath: string, entry: { path: string; kind: "file" | "directory" }) => {
        const tab = norm(tabPath);
        const target = norm(entry.path);
        if (entry.kind === "file") return tab === target;
        return tab === target || tab.startsWith(`${target}/`);
      };

      setTabs((prev) => {
        const next = prev.filter(
          (tab) => !entries.some((entry) => matches(tab.path, entry))
        );
        setActiveId((current) => {
          if (!current || next.some((tab) => tab.id === current)) return current;
          if (next.length === 0) return null;
          const oldIndex = prev.findIndex((tab) => tab.id === current);
          const nextIndex = Math.min(Math.max(oldIndex, 0), next.length - 1);
          return next[nextIndex]?.id ?? null;
        });
        return next;
      });
    },
    []
  );

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
    buildEditorTabTitle,
    setActiveId,
    openFile,
    updateActiveContent,
    applyExternalContent,
    reloadOpenPaths,
    saveTab,
    saveActiveTab,
    saveAllDirty,
    saveActiveTabAs,
    revertActiveTab,
    removeTab,
    closeAllTabs,
    removeTabsForDeletedEntries,
    isTabDirty,
  };
}
