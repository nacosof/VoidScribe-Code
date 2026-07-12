import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorTab } from "@/hooks/useEditorTabs";
import type { PendingFileChange } from "@/types";
import { hasLintErrors, lintFileContent } from "@/lib/editor-lint";
import { normalizeWorkspacePath, pathsEqual } from "@/shared/lib/paths";

const LINT_DEBOUNCE_MS = 1800;
const LINT_CONCURRENCY = 2;

function normalizePath(path: string): string {
    return normalizeWorkspacePath(path).replace(/^\.\//, "");
}

function contentForPath(path: string, tabs: EditorTab[], pending: PendingFileChange[]): string | null {
    const tab = tabs.find((item) => pathsEqual(item.path, path));
    if (tab)
        return tab.content;
    const change = pending.find((item) => pathsEqual(item.path, path));
    if (change && change.kind !== "deleted")
        return change.newContent;
    return null;
}

function contentSignature(path: string, content: string): string {
    return `${path}\0${content.length}\0${content.slice(0, 96)}\0${content.slice(-96)}`;
}

const lintCache = new Map<string, boolean>();

async function lintPath(path: string, tabs: EditorTab[], pending: PendingFileChange[]): Promise<boolean> {
    let content = contentForPath(path, tabs, pending);
    if (content === null) {
        const disk = await window.voidscribe.readWorkspaceFile(path);
        if (!disk.ok)
            return lintCache.get(path) ?? false;
        content = disk.content;
    }
    const signature = contentSignature(path, content);
    const cached = lintCache.get(signature);
    if (cached !== undefined)
        return cached;
    const diagnostics = await lintFileContent(path, content);
    const hasErrors = hasLintErrors(diagnostics);
    lintCache.set(signature, hasErrors);
    return hasErrors;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let index = 0;
    async function run(): Promise<void> {
        while (index < items.length) {
            const current = index;
            index += 1;
            results[current] = await worker(items[current]!);
        }
    }
    const runners = Array.from({ length: Math.min(limit, items.length) }, () => run());
    await Promise.all(runners);
    return results;
}

export function useFileTreeLintStatus(input: {
    workspacePath: string;
    tabs: EditorTab[];
    pendingChanges: PendingFileChange[];
    treeFilePaths: string[];
}): ReadonlySet<string> {
    const pathsToLint = useMemo(() => {
        const paths = new Set<string>();
        for (const path of input.treeFilePaths) {
            paths.add(normalizePath(path));
        }
        for (const tab of input.tabs) {
            paths.add(normalizePath(tab.path));
        }
        for (const change of input.pendingChanges) {
            if (change.kind !== "deleted")
                paths.add(normalizePath(change.path));
        }
        return [...paths];
    }, [input.treeFilePaths, input.tabs, input.pendingChanges]);
    const [errorPaths, setErrorPaths] = useState<ReadonlySet<string>>(() => new Set());
    const tabsRef = useRef(input.tabs);
    const pendingRef = useRef(input.pendingChanges);
    tabsRef.current = input.tabs;
    pendingRef.current = input.pendingChanges;
    useEffect(() => {
        lintCache.clear();
        setErrorPaths(new Set());
    }, [input.workspacePath]);
    useEffect(() => {
        if (!input.workspacePath.trim() || pathsToLint.length === 0)
            return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            void (async () => {
                const flags = await mapWithConcurrency(pathsToLint, LINT_CONCURRENCY, async (path) => ({
                    path,
                    hasErrors: await lintPath(path, tabsRef.current, pendingRef.current),
                }));
                if (cancelled)
                    return;
                const next = new Set<string>();
                for (const item of flags) {
                    if (item.hasErrors)
                        next.add(item.path);
                }
                setErrorPaths(next);
            })();
        }, LINT_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [input.workspacePath, pathsToLint]);
    return errorPaths;
}
