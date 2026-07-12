import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CHAT_ENTRY_DRAG_MIME } from "@/lib/chat-context";
import type { UiLanguage, WorkspaceTreeNode } from "@/types";
import { collectTreeFilePaths } from "@/lib/workspace-tree";
import { t } from "@/lib/i18n";
const SKIP_DELETE_CONFIRM_KEY = "voidscribe-skip-delete-confirm";
const EMPTY_PATH_SET: ReadonlySet<string> = new Set();
type FileExplorerProps = {
    workspacePath: string;
    selectedPath: string | null;
    refreshKey?: number;
    lang: UiLanguage;
    pendingPaths?: ReadonlySet<string>;
    errorPaths?: ReadonlySet<string>;
    onTreeFilePathsChange?: (paths: string[]) => void;
    onSelectFile: (path: string) => void;
    onTreeRefresh: () => void;
    onEntriesDeleted?: (entries: Array<{
        path: string;
        kind: "file" | "directory";
    }>) => void;
};
export type FileExplorerHandle = {
    clearSelection: () => void;
};
type ContextTarget = {
    kind: "root";
    parentPath: ".";
} | {
    kind: "directory";
    path: string;
    name: string;
} | {
    kind: "file";
    path: string;
    name: string;
};
type DeletableTarget = Extract<ContextTarget, {
    kind: "directory" | "file";
}>;
type ContextMenuState = {
    x: number;
    y: number;
    target: ContextTarget;
};
type NameDialogState = {
    mode: "create-file" | "create-folder" | "rename";
    parentPath: string;
    targetPath?: string;
    initialName?: string;
};
function normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
}
function findTargetByPath(path: string, nodes: WorkspaceTreeNode[]): DeletableTarget | null {
    for (const node of nodes) {
        if (node.path === path) {
            return node.kind === "directory"
                ? { kind: "directory", path: node.path, name: node.name }
                : { kind: "file", path: node.path, name: node.name };
        }
        if (node.children?.length) {
            const found = findTargetByPath(path, node.children);
            if (found)
                return found;
        }
    }
    return null;
}
function dedupeDeleteTargets(targets: DeletableTarget[]): DeletableTarget[] {
    return targets.filter((item) => {
        const norm = normalizePath(item.path);
        return !targets.some((other) => {
            if (other.path === item.path)
                return false;
            if (other.kind !== "directory")
                return false;
            const otherNorm = normalizePath(other.path);
            return norm === otherNorm || norm.startsWith(`${otherNorm}/`);
        });
    });
}
function shouldSkipDeleteConfirm(): boolean {
    try {
        return localStorage.getItem(SKIP_DELETE_CONFIRM_KEY) === "1";
    }
    catch {
        return false;
    }
}
function fileIcon(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (["ts", "tsx"].includes(ext))
        return "TS";
    if (["js", "jsx"].includes(ext))
        return "JS";
    if (ext === "json")
        return "{}";
    if (ext === "css")
        return "#";
    if (["html", "htm"].includes(ext))
        return "<>";
    if (ext === "md")
        return "M";
    return "·";
}
type TreeNodeProps = {
    node: WorkspaceTreeNode;
    depth: number;
    selectedPaths: Set<string>;
    expanded: Set<string>;
    pendingPaths: ReadonlySet<string>;
    errorPaths: ReadonlySet<string>;
    onToggle: (path: string) => void;
    onItemClick: (event: React.MouseEvent, target: DeletableTarget) => void;
    onContextMenu: (event: React.MouseEvent, target: ContextTarget) => void;
};
function nodePathKey(path: string): string {
    return normalizePath(path);
}
function TreeNode({ node, depth, selectedPaths, expanded, pendingPaths, errorPaths, onToggle, onItemClick, onContextMenu, }: TreeNodeProps) {
    const isDir = node.kind === "directory";
    const isExcluded = Boolean(node.excluded);
    const canExpand = isDir && !isExcluded;
    const isOpen = canExpand && expanded.has(node.path);
    const isSelected = selectedPaths.has(node.path);
    const pathKey = nodePathKey(node.path);
    const hasError = !isDir && errorPaths.has(pathKey);
    const isPending = !isDir && pendingPaths.has(pathKey);
    const statusClass = hasError
        ? " file-tree__row--error"
        : isPending
            ? " file-tree__row--pending"
            : "";
    const target: DeletableTarget = isDir
        ? { kind: "directory", path: node.path, name: node.name }
        : { kind: "file", path: node.path, name: node.name };
    return (<>
      <button type="button" className={`file-tree__row${isSelected ? " file-tree__row--selected" : ""}${isExcluded ? " file-tree__row--excluded" : ""}${statusClass}`} style={{ paddingLeft: 8 + depth * 14 }} draggable={!isExcluded} onDragStart={(event) => {
            event.dataTransfer.setData(CHAT_ENTRY_DRAG_MIME, JSON.stringify({
                kind: isDir ? "directory" : "file",
                path: node.path,
                name: node.name,
            }));
            event.dataTransfer.effectAllowed = "copy";
        }} onClick={(event) => {
            onItemClick(event, target);
            if (canExpand && !event.ctrlKey && !event.metaKey) {
                onToggle(node.path);
            }
        }} onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onContextMenu(event, target);
        }} title={node.path}>
        {canExpand ? (<svg className={`file-tree__chevron${isOpen ? " file-tree__chevron--open" : ""}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6"/>
          </svg>) : (<span className="file-tree__chevron-spacer" aria-hidden/>)}
        <span className={`file-tree__icon${isDir ? " file-tree__icon--folder" : ""}`}>
          {isDir ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
            </svg>) : (fileIcon(node.name))}
        </span>
        <span className="file-tree__name">{node.name}</span>
      </button>

      {isDir && isOpen
            ? node.children?.map((child) => (<TreeNode key={child.path} node={child} depth={depth + 1} selectedPaths={selectedPaths} expanded={expanded} pendingPaths={pendingPaths} errorPaths={errorPaths} onToggle={onToggle} onItemClick={onItemClick} onContextMenu={onContextMenu}/>))
            : null}
    </>);
}
export const FileExplorer = forwardRef<FileExplorerHandle, FileExplorerProps>(function FileExplorer({ workspacePath, selectedPath, refreshKey = 0, lang, pendingPaths, errorPaths, onTreeFilePathsChange, onSelectFile, onTreeRefresh, onEntriesDeleted, }, ref) {
    const [rootName, setRootName] = useState("");
    const [nodes, setNodes] = useState<WorkspaceTreeNode[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["."]));
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
    const [deleteTargets, setDeleteTargets] = useState<DeletableTarget[]>([]);
    const [dontAskDeleteAgain, setDontAskDeleteAgain] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const [actionError, setActionError] = useState("");
    const nameInputRef = useRef<HTMLInputElement>(null);
    const treeRef = useRef<HTMLDivElement>(null);
    const onTreeFilePathsChangeRef = useRef(onTreeFilePathsChange);
    onTreeFilePathsChangeRef.current = onTreeFilePathsChange;
    const cachedTreeRef = useRef<{ workspacePath: string; hasNodes: boolean }>({
        workspacePath: "",
        hasNodes: false,
    });
    const clearTreeSelection = useCallback(() => {
        setSelectedPaths(new Set());
        setContextMenu(null);
    }, []);
    useImperativeHandle(ref, () => ({ clearSelection: clearTreeSelection }), [
        clearTreeSelection,
    ]);
    function isBackgroundTreeTarget(target: HTMLElement): boolean {
        return !target.closest(".file-tree__row, .file-tree__menu, .file-tree__root, .modal-backdrop, .file-tree__dialog");
    }
    function handleTreeBackgroundMouseDown(event: React.MouseEvent) {
        if (event.button !== 0)
            return;
        if (!isBackgroundTreeTarget(event.target as HTMLElement))
            return;
        clearTreeSelection();
    }
    useEffect(() => {
        if (!selectedPath) {
            setSelectedPaths(new Set());
            return;
        }
        setSelectedPaths(new Set([selectedPath]));
    }, [selectedPath]);
    useEffect(() => {
        setNodes([]);
        setRootName("");
        setError("");
        setLoading(Boolean(workspacePath.trim()));
        setRefreshing(false);
        cachedTreeRef.current = { workspacePath, hasNodes: false };
    }, [workspacePath]);
    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!workspacePath.trim()) {
                setNodes([]);
                setRootName("");
                setLoading(false);
                setRefreshing(false);
                onTreeFilePathsChangeRef.current?.([]);
                return;
            }
            const hasCachedTree = cachedTreeRef.current.workspacePath === workspacePath &&
                cachedTreeRef.current.hasNodes;
            if (hasCachedTree)
                setRefreshing(true);
            else
                setLoading(true);
            setError("");
            const result = await window.voidscribe.listWorkspaceTree();
            if (cancelled)
                return;
            if (!result.ok) {
                setError(result.error);
                if (!hasCachedTree) {
                    setNodes([]);
                    setRootName("");
                    onTreeFilePathsChangeRef.current?.([]);
                }
                setLoading(false);
                setRefreshing(false);
                return;
            }
            setRootName(result.rootName);
            setNodes(result.nodes);
            cachedTreeRef.current = { workspacePath, hasNodes: true };
            onTreeFilePathsChangeRef.current?.(collectTreeFilePaths(result.nodes));
            setLoading(false);
            setRefreshing(false);
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [workspacePath, refreshKey]);
    useEffect(() => {
        if (!nameDialog)
            return;
        setNameInput(nameDialog.initialName ?? "");
        const timer = window.setTimeout(() => nameInputRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [nameDialog]);
    useEffect(() => {
        if (!contextMenu)
            return;
        function closeMenu(event: Event) {
            const target = event.target;
            if (target instanceof Element && target.closest(".file-tree__menu")) {
                return;
            }
            setContextMenu(null);
        }
        function closeOnScroll() {
            setContextMenu(null);
        }
        window.addEventListener("mousedown", closeMenu);
        window.addEventListener("scroll", closeOnScroll, true);
        return () => {
            window.removeEventListener("mousedown", closeMenu);
            window.removeEventListener("scroll", closeOnScroll, true);
        };
    }, [contextMenu]);
    const resolveSelectedTargets = useCallback((): DeletableTarget[] => {
        return [...selectedPaths]
            .map((path) => findTargetByPath(path, nodes))
            .filter((target): target is DeletableTarget => target !== null);
    }, [nodes, selectedPaths]);
    const executeDelete = useCallback(async (targets: DeletableTarget[]) => {
        const uniqueTargets = dedupeDeleteTargets(targets);
        if (!uniqueTargets.length)
            return;
        for (const target of uniqueTargets) {
            const result = await window.voidscribe.deleteWorkspaceEntry(target.path);
            if (!result.ok) {
                setError(result.error);
                return;
            }
        }
        setDeleteTargets([]);
        setSelectedPaths(new Set());
        onEntriesDeleted?.(uniqueTargets.map((target) => ({
            path: target.path,
            kind: target.kind,
        })));
        onTreeRefresh();
    }, [onEntriesDeleted, onTreeRefresh]);
    const requestDelete = useCallback((targets: DeletableTarget[]) => {
        const uniqueTargets = dedupeDeleteTargets(targets);
        if (!uniqueTargets.length)
            return;
        if (shouldSkipDeleteConfirm()) {
            void executeDelete(uniqueTargets);
            return;
        }
        setDontAskDeleteAgain(false);
        setDeleteTargets(uniqueTargets);
    }, [executeDelete]);
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key !== "Delete" && event.key !== "Backspace")
                return;
            if (nameDialog || deleteTargets.length > 0)
                return;
            const active = document.activeElement;
            if (active instanceof HTMLInputElement ||
                active instanceof HTMLTextAreaElement ||
                active?.getAttribute("contenteditable") === "true") {
                return;
            }
            const targets = resolveSelectedTargets();
            if (!targets.length)
                return;
            event.preventDefault();
            requestDelete(targets);
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [deleteTargets.length, nameDialog, requestDelete, resolveSelectedTargets]);
    function handleToggle(path: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(path))
                next.delete(path);
            else
                next.add(path);
            return next;
        });
    }
    function handleItemClick(event: React.MouseEvent, target: DeletableTarget) {
        const multi = event.ctrlKey || event.metaKey;
        if (multi) {
            setSelectedPaths((prev) => {
                const next = new Set(prev);
                if (next.has(target.path))
                    next.delete(target.path);
                else
                    next.add(target.path);
                return next;
            });
            return;
        }
        setSelectedPaths(new Set([target.path]));
        if (target.kind === "file") {
            onSelectFile(target.path);
        }
    }
    function openContextMenu(event: React.MouseEvent, target: ContextTarget) {
        if (target.kind !== "root") {
            setSelectedPaths((prev) => {
                if (prev.has(target.path))
                    return prev;
                return new Set([target.path]);
            });
        }
        setContextMenu({ x: event.clientX, y: event.clientY, target });
    }
    function parentPathFor(target: ContextTarget): string {
        if (target.kind === "root")
            return ".";
        if (target.kind === "directory")
            return target.path;
        const parent = target.path.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
        return parent || ".";
    }
    function openCreateFile(target: ContextTarget) {
        setContextMenu(null);
        setActionError("");
        setNameDialog({
            mode: "create-file",
            parentPath: parentPathFor(target),
        });
    }
    function openCreateFolder(target: ContextTarget) {
        setContextMenu(null);
        setActionError("");
        setNameDialog({
            mode: "create-folder",
            parentPath: parentPathFor(target),
        });
    }
    function openRename(target: ContextTarget) {
        if (target.kind === "root")
            return;
        setContextMenu(null);
        setActionError("");
        setNameDialog({
            mode: "rename",
            parentPath: ".",
            targetPath: target.path,
            initialName: target.name,
        });
    }
    function openDeleteConfirm(target: ContextTarget) {
        if (target.kind === "root")
            return;
        setContextMenu(null);
        const targets = selectedPaths.has(target.path) && selectedPaths.size > 1
            ? resolveSelectedTargets()
            : [target];
        requestDelete(targets);
    }
    async function confirmDelete() {
        if (dontAskDeleteAgain) {
            try {
                localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, "1");
            }
            catch {
            }
        }
        await executeDelete(deleteTargets);
    }
    async function submitNameDialog() {
        if (!nameDialog)
            return;
        const name = nameInput.trim();
        if (!name)
            return;
        setActionError("");
        if (nameDialog.mode === "create-file") {
            const result = await window.voidscribe.createWorkspaceFile(nameDialog.parentPath, name);
            if (!result.ok) {
                setActionError(result.error);
                return;
            }
            setExpanded((prev) => {
                const next = new Set(prev);
                if (nameDialog.parentPath !== ".")
                    next.add(nameDialog.parentPath);
                return next;
            });
            setNameDialog(null);
            onTreeRefresh();
            onSelectFile(result.path);
            return;
        }
        if (nameDialog.mode === "create-folder") {
            const result = await window.voidscribe.createWorkspaceDirectory(nameDialog.parentPath, name);
            if (!result.ok) {
                setActionError(result.error);
                return;
            }
            setExpanded((prev) => {
                const next = new Set(prev);
                if (nameDialog.parentPath !== ".")
                    next.add(nameDialog.parentPath);
                next.add(result.path);
                return next;
            });
            setNameDialog(null);
            onTreeRefresh();
            return;
        }
        if (nameDialog.mode === "rename" && nameDialog.targetPath) {
            const result = await window.voidscribe.renameWorkspaceEntry(nameDialog.targetPath, name);
            if (!result.ok) {
                setActionError(result.error);
                return;
            }
            setNameDialog(null);
            onTreeRefresh();
            if (nameDialog.targetPath === selectedPath) {
                onSelectFile(result.path);
            }
        }
    }
    if (loading && nodes.length === 0) {
        return <p className="file-tree__status">{t(lang, "fileTreeLoading")}</p>;
    }
    if (error) {
        return <p className="file-tree__status file-tree__status--error">{error}</p>;
    }
    const menuTarget = contextMenu?.target;
    const showRenameDelete = menuTarget?.kind === "directory" || menuTarget?.kind === "file";
    const canRename = showRenameDelete && selectedPaths.size <= 1;
    function handleTreeContextMenu(event: React.MouseEvent) {
        if ((event.target as HTMLElement).closest(".file-tree__row, .file-tree__menu, .file-tree__root")) {
            return;
        }
        event.preventDefault();
        setSelectedPaths(new Set());
        openContextMenu(event, { kind: "root", parentPath: "." });
    }
    const deleteMessage = deleteTargets.length === 1
        ? t(lang, "deleteEntryMessage", deleteTargets[0]!.name)
        : t(lang, "deleteEntriesMessage", deleteTargets.length);
    const nameDialogPortal = nameDialog &&
        createPortal(<div className="modal-backdrop" onClick={() => {
                setNameDialog(null);
                setActionError("");
            }}>
        <div className="modal modal--compact file-tree__dialog" onClick={(event) => event.stopPropagation()}>
          <h2>
            {nameDialog.mode === "create-file"
                ? t(lang, "newFile")
                : nameDialog.mode === "create-folder"
                    ? t(lang, "newFolder")
                    : t(lang, "rename")}
          </h2>
          <label className="field">
            <span>
              {nameDialog.mode === "create-file"
                ? t(lang, "enterFileName")
                : nameDialog.mode === "create-folder"
                    ? t(lang, "enterFolderName")
                    : t(lang, "enterNewName")}
            </span>
            <input ref={nameInputRef} value={nameInput} onChange={(event) => setNameInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter")
                    void submitNameDialog();
                if (event.key === "Escape")
                    setNameDialog(null);
            }}/>
          </label>
          {actionError ? (<p className="file-tree__status file-tree__status--error">
              {actionError}
            </p>) : null}
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setNameDialog(null)}>
              {t(lang, "cancel")}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void submitNameDialog()}>
              {t(lang, "save")}
            </button>
          </div>
        </div>
      </div>, document.body);
    const deleteDialogPortal = deleteTargets.length > 0 &&
        createPortal(<ConfirmDialog open title={t(lang, "deleteEntryTitle")} message={deleteMessage} confirmLabel={t(lang, "delete")} cancelLabel={t(lang, "cancel")} danger dontAskAgainLabel={t(lang, "deleteDontAskAgain")} dontAskAgain={dontAskDeleteAgain} onDontAskAgainChange={setDontAskDeleteAgain} onCancel={() => setDeleteTargets([])} onConfirm={() => void confirmDelete()}/>, document.body);
    return (<div ref={treeRef} className={`file-tree${refreshing ? " file-tree--refreshing" : ""}`} tabIndex={-1} onMouseDown={handleTreeBackgroundMouseDown} onContextMenu={handleTreeContextMenu}>
      <div className="file-tree__root" onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedPaths(new Set());
            openContextMenu(event, { kind: "root", parentPath: "." });
        }}>
        {rootName.toUpperCase()}
      </div>
      <div className="file-tree__list" onMouseDown={handleTreeBackgroundMouseDown}>
        {nodes.map((node) => (<TreeNode key={node.path} node={node} depth={0} selectedPaths={selectedPaths} expanded={expanded} pendingPaths={pendingPaths ?? EMPTY_PATH_SET} errorPaths={errorPaths ?? EMPTY_PATH_SET} onToggle={handleToggle} onItemClick={handleItemClick} onContextMenu={openContextMenu}/>))}
      </div>

      {contextMenu ? (<div className="file-tree__menu" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu" onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className="file-tree__menu-item" role="menuitem" onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openCreateFile(contextMenu.target);
            }}>
            {t(lang, "newFile")}
          </button>
          <button type="button" className="file-tree__menu-item" role="menuitem" onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openCreateFolder(contextMenu.target);
            }}>
            {t(lang, "newFolder")}
          </button>
          {showRenameDelete ? (<>
              <div className="file-tree__menu-sep"/>
              {canRename ? (<button type="button" className="file-tree__menu-item" role="menuitem" onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openRename(contextMenu.target);
                    }}>
                  {t(lang, "rename")}
                </button>) : null}
              <button type="button" className="file-tree__menu-item file-tree__menu-item--danger" role="menuitem" onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openDeleteConfirm(contextMenu.target);
                }}>
                {t(lang, "delete")}
                {selectedPaths.size > 1 ? ` (${selectedPaths.size})` : ""}
              </button>
            </>) : null}
        </div>) : null}

      {nameDialogPortal}
      {deleteDialogPortal}
    </div>);
});
