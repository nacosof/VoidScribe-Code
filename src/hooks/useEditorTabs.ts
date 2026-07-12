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
function normalizeEditorText(text: string): string {
    return text.replace(/\r\n/g, "\n");
}
function isTabContentDirty(tab: EditorTab): boolean {
    return (normalizeEditorText(tab.content) !== normalizeEditorText(tab.savedContent));
}
function fileNameFromPath(path: string): string {
    const parts = normalizeTabPath(path).split("/");
    return parts[parts.length - 1] || path;
}
export function isEditorTabDirty(tab: EditorTab): boolean {
    return isTabContentDirty(tab);
}
export type SaveTabResult = {
    ok: true;
} | {
    ok: false;
    error: string;
};
export function buildEditorTabTitle(path: string, allPaths: string[]): string {
    const base = fileNameFromPath(path);
    const sameNameCount = allPaths.filter((item) => fileNameFromPath(item) === base).length;
    if (sameNameCount <= 1)
        return base;
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
    const tabsRef = useRef<EditorTab[]>([]);
    tabsRef.current = tabs;
    const openingPathsRef = useRef(new Map<string, Promise<{
        ok: boolean;
    }>>());
    const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeId) ?? null, [tabs, activeId]);
    const activePath = activeTab?.path ?? null;
    const hasDirtyTabs = tabs.some(isTabContentDirty);
    const activeIdRef = useRef<string | null>(null);
    activeIdRef.current = activeId;
    const updateTab = useCallback((tabId: string, patch: Partial<EditorTab>) => {
        setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab)));
    }, []);
    const openFile = useCallback(async (relativePath: string) => {
        const path = normalizeTabPath(relativePath);
        const activateExistingTab = async (existingId: string) => {
            const existing = tabsRef.current.find((tab) => tab.id === existingId);
            if (existing && !isTabContentDirty(existing)) {
                const disk = await window.voidscribe.readWorkspaceFile(path);
                if (disk.ok) {
                    const normalized = normalizeEditorText(disk.content);
                    setTabs((prev) => prev.map((tab) => tab.id === existingId
                        ? {
                            ...tab,
                            content: normalized,
                            savedContent: normalized,
                            error: "",
                        }
                        : tab));
                }
            }
            setActiveId(existingId);
        };
        const inflight = openingPathsRef.current.get(path);
        if (inflight) {
            await inflight;
            let existingId: string | null = null;
            setTabs((prev) => {
                const existing = prev.find((tab) => normalizeTabPath(tab.path) === path);
                if (existing)
                    existingId = existing.id;
                return prev;
            });
            if (existingId) {
                await activateExistingTab(existingId);
                return { ok: true as const };
            }
        }
        const task = (async () => {
            let existingId: string | null = null;
            setTabs((prev) => {
                const existing = prev.find((tab) => normalizeTabPath(tab.path) === path);
                if (existing)
                    existingId = existing.id;
                return prev;
            });
            if (existingId) {
                await activateExistingTab(existingId);
                return { ok: true as const };
            }
            const result = await window.voidscribe.readWorkspaceFile(path);
            if (!result.ok) {
                return { ok: false as const, error: result.error };
            }
            const tab: EditorTab = {
                id: createId(),
                path,
                content: normalizeEditorText(result.content),
                savedContent: normalizeEditorText(result.content),
                error: "",
                saving: false,
            };
            setTabs((prev) => {
                const existing = prev.find((item) => normalizeTabPath(item.path) === path);
                if (existing) {
                    setActiveId(existing.id);
                    return prev;
                }
                return [...prev, tab];
            });
            setActiveId(tab.id);
            return { ok: true as const };
        })();
        openingPathsRef.current.set(path, task);
        try {
            return await task;
        }
        finally {
            openingPathsRef.current.delete(path);
        }
    }, []);
    const openFileWithContent = useCallback(async (relativePath: string, content: string) => {
        const path = normalizeTabPath(relativePath);
        const normalized = normalizeEditorText(content);
        let existingId: string | null = null;
        setTabs((prev) => {
            const existing = prev.find((tab) => normalizeTabPath(tab.path) === path);
            if (existing)
                existingId = existing.id;
            return prev;
        });
        if (existingId) {
            setTabs((prev) => prev.map((tab) => tab.id === existingId
                ? {
                    ...tab,
                    content: normalized,
                    savedContent: normalized,
                    error: "",
                }
                : tab));
            setActiveId(existingId);
            return { ok: true as const };
        }
        const tab: EditorTab = {
            id: createId(),
            path,
            content: normalized,
            savedContent: normalized,
            error: "",
            saving: false,
        };
        setTabs((prev) => [...prev, tab]);
        setActiveId(tab.id);
        return { ok: true as const };
    }, []);
    const updateActiveContent = useCallback((content: string) => {
        const tabId = activeIdRef.current;
        if (!tabId)
            return;
        const normalized = normalizeEditorText(content);
        setTabs((prev) => prev.map((tab) => tab.id === tabId ? { ...tab, content: normalized } : tab));
    }, []);
    const applyExternalContent = useCallback((path: string, content: string) => {
        const norm = normalizeTabPath(path);
        const normalized = normalizeEditorText(content);
        setTabs((prev) => prev.map((tab) => normalizeTabPath(tab.path) === norm
            ? { ...tab, content: normalized, savedContent: normalized, error: "" }
            : tab));
    }, []);
    const reloadOpenPaths = useCallback(async (paths: string[]) => {
        const unique = [...new Set(paths.map(normalizeTabPath))];
        for (const path of unique) {
            const result = await window.voidscribe.readWorkspaceFile(path);
            if (result.ok) {
                applyExternalContent(path, result.content);
            }
            else {
                setTabs((prev) => prev.filter((tab) => normalizeTabPath(tab.path) !== path));
            }
        }
    }, [applyExternalContent]);
    const resetTabSaving = useCallback((tabId: string) => {
        updateTab(tabId, { saving: false });
    }, [updateTab]);
    const syncTabContent = useCallback((tabId: string, content: string) => {
        const normalized = normalizeEditorText(content);
        setTabs((prev) => prev.map((tab) => tab.id === tabId ? { ...tab, content: normalized } : tab));
    }, []);
    const saveTab = useCallback(async (tabId: string, contentOverride?: string): Promise<SaveTabResult> => {
        const tab = tabsRef.current.find((item) => item.id === tabId);
        if (!tab) {
            return { ok: false, error: "Вкладка не найдена." };
        }
        const content = normalizeEditorText(contentOverride ?? tab.content);
        const path = tab.path;
        setTabs((prev) => prev.map((item) => item.id === tabId ? { ...item, content, saving: true, error: "" } : item));
        const result = await window.voidscribe.writeWorkspaceFile(path, content);
        if (!result.ok) {
            updateTab(tabId, { saving: false, error: result.error });
            return { ok: false, error: result.error };
        }
        setTabs((prev) => prev.map((item) => item.id === tabId
            ? {
                ...item,
                saving: false,
                savedContent: content,
                content,
                error: "",
            }
            : item));
        return { ok: true };
    }, [updateTab]);
    const markTabSaved = useCallback((tabId: string, content: string, path?: string) => {
        const normalized = normalizeEditorText(content);
        const normalizedPath = path ? normalizeTabPath(path) : null;
        setTabs((prev) => prev.map((item) => {
            const matches = item.id === tabId ||
                (normalizedPath !== null && normalizeTabPath(item.path) === normalizedPath);
            if (!matches)
                return item;
            return {
                ...item,
                content: normalized,
                savedContent: normalized,
                saving: false,
                error: "",
            };
        }));
    }, []);
    const saveActiveTab = useCallback(async (contentOverride?: string): Promise<SaveTabResult> => {
        if (!activeId)
            return { ok: false, error: "Нет открытого файла." };
        return saveTab(activeId, contentOverride);
    }, [activeId, saveTab]);
    const saveAllDirty = useCallback(async (): Promise<SaveTabResult> => {
        let dirtyIds: string[] = [];
        setTabs((prev) => {
            dirtyIds = prev.filter(isTabContentDirty).map((tab) => tab.id);
            return prev;
        });
        for (const tabId of dirtyIds) {
            const result = await saveTab(tabId);
            if (!result.ok)
                return result;
        }
        return { ok: true };
    }, [saveTab]);
    const revertActiveTab = useCallback(async () => {
        if (!activeId)
            return false;
        const tab = tabs.find((item) => item.id === activeId);
        if (!tab)
            return false;
        const result = await window.voidscribe.readWorkspaceFile(tab.path);
        if (!result.ok) {
            updateTab(activeId, { error: result.error });
            return false;
        }
        updateTab(activeId, {
            content: normalizeEditorText(result.content),
            savedContent: normalizeEditorText(result.content),
            error: "",
        });
        return true;
    }, [activeId, tabs, updateTab]);
    const saveActiveTabAs = useCallback(async (contentOverride?: string) => {
        if (!activeId)
            return false;
        const tab = tabs.find((item) => item.id === activeId);
        if (!tab)
            return false;
        const content = normalizeEditorText(contentOverride ?? tab.content);
        const picked = await window.voidscribe.pickSaveFileAs(tab.path);
        if (!picked.ok)
            return false;
        updateTab(activeId, { saving: true, error: "" });
        const result = await window.voidscribe.writeWorkspaceFile(picked.relativePath, content);
        if (!result.ok) {
            updateTab(activeId, { saving: false, error: result.error });
            return false;
        }
        const oldPath = normalizeTabPath(tab.path);
        const newPath = normalizeTabPath(picked.relativePath);
        setTabs((prev) => {
            const next = prev.filter((item) => item.id === activeId ||
                normalizeTabPath(item.path) !== oldPath);
            return next.map((item) => item.id === activeId
                ? {
                    ...item,
                    path: newPath,
                    savedContent: item.content,
                    saving: false,
                    error: "",
                }
                : item);
        });
        return true;
    }, [activeId, tabs, updateTab]);
    const removeTab = useCallback((tabId: string) => {
        setTabs((prev) => {
            const index = prev.findIndex((tab) => tab.id === tabId);
            if (index < 0)
                return prev;
            const next = prev.filter((tab) => tab.id !== tabId);
            setActiveId((current) => {
                if (current !== tabId)
                    return current;
                if (next.length === 0)
                    return null;
                const nextIndex = Math.min(index, next.length - 1);
                return next[nextIndex]?.id ?? null;
            });
            return next;
        });
    }, []);
    const removeTabByPath = useCallback((relativePath: string) => {
        const path = normalizeTabPath(relativePath);
        setTabs((prev) => {
            const index = prev.findIndex((tab) => normalizeTabPath(tab.path) === path);
            if (index < 0)
                return prev;
            const removedId = prev[index]!.id;
            const next = prev.filter((tab) => normalizeTabPath(tab.path) !== path);
            setActiveId((current) => {
                if (current !== removedId)
                    return current;
                if (next.length === 0)
                    return null;
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
    const restoreTabs = useCallback(async (paths: string[], activePath: string | null) => {
        const opened: EditorTab[] = [];
        for (const relativePath of paths) {
            const path = normalizeTabPath(relativePath);
            const result = await window.voidscribe.readWorkspaceFile(path);
            if (!result.ok)
                continue;
            opened.push({
                id: createId(),
                path,
                content: normalizeEditorText(result.content),
                savedContent: normalizeEditorText(result.content),
                error: "",
                saving: false,
            });
        }
        if (!opened.length) {
            setTabs([]);
            setActiveId(null);
            return;
        }
        const activeNorm = activePath ? normalizeTabPath(activePath) : null;
        const activeTab = (activeNorm
            ? opened.find((tab) => normalizeTabPath(tab.path) === activeNorm)
            : null) ?? opened[0]!;
        setTabs(opened);
        setActiveId(activeTab.id);
    }, []);
    const removeTabsForDeletedEntries = useCallback((entries: Array<{
        path: string;
        kind: "file" | "directory";
    }>) => {
        if (entries.length === 0)
            return;
        const norm = (value: string) => normalizeTabPath(value);
        const matches = (tabPath: string, entry: {
            path: string;
            kind: "file" | "directory";
        }) => {
            const tab = norm(tabPath);
            const target = norm(entry.path);
            if (entry.kind === "file")
                return tab === target;
            return tab === target || tab.startsWith(`${target}/`);
        };
        setTabs((prev) => {
            const next = prev.filter((tab) => !entries.some((entry) => matches(tab.path, entry)));
            setActiveId((current) => {
                if (!current || next.some((tab) => tab.id === current))
                    return current;
                if (next.length === 0)
                    return null;
                const oldIndex = prev.findIndex((tab) => tab.id === current);
                const nextIndex = Math.min(Math.max(oldIndex, 0), next.length - 1);
                return next[nextIndex]?.id ?? null;
            });
            return next;
        });
    }, []);
    const isTabDirty = useCallback((tabId: string) => {
        const tab = tabs.find((item) => item.id === tabId);
        return tab ? isTabContentDirty(tab) : false;
    }, [tabs]);
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
        openFileWithContent,
        updateActiveContent,
        applyExternalContent,
        reloadOpenPaths,
        saveTab,
        markTabSaved,
        resetTabSaving,
        syncTabContent,
        saveActiveTab,
        saveAllDirty,
        saveActiveTabAs,
        revertActiveTab,
        removeTab,
        removeTabByPath,
        closeAllTabs,
        restoreTabs,
        removeTabsForDeletedEntries,
        isTabDirty,
    };
}
