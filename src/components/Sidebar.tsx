import { useRef } from "react";
import type { UiLanguage } from "@/types";
import { FileExplorer, type FileExplorerHandle } from "./FileExplorer";
import { t } from "@/lib/i18n";
type Props = {
    workspacePath: string;
    selectedPath: string | null;
    refreshKey: number;
    lang: UiLanguage;
    pendingPaths?: ReadonlySet<string>;
    errorPaths?: ReadonlySet<string>;
    onTreeFilePathsChange?: (paths: string[]) => void;
    onOpenFile: (path: string) => void;
    onRefresh: () => void;
    onEntriesDeleted: (entries: Array<{
        path: string;
        kind: "file" | "directory";
    }>) => void;
};
export function Sidebar({ workspacePath, selectedPath, refreshKey, lang, pendingPaths, errorPaths, onTreeFilePathsChange, onOpenFile, onRefresh, onEntriesDeleted, }: Props) {
    const explorerRef = useRef<FileExplorerHandle>(null);
    function handleSidebarBackgroundMouseDown(event: React.MouseEvent) {
        if (event.button !== 0)
            return;
        const target = event.target as HTMLElement;
        if (target.closest(".file-tree__row, .file-tree__menu, .file-tree__root")) {
            return;
        }
        explorerRef.current?.clearSelection();
    }
    return (<aside className="sidebar">
      <div className="sidebar__body" onMouseDown={handleSidebarBackgroundMouseDown}>
        {!workspacePath ? (<div className="sidebar__empty">
            <p>{t(lang, "noWorkspace")}</p>
          </div>) : (<FileExplorer ref={explorerRef} workspacePath={workspacePath} selectedPath={selectedPath} refreshKey={refreshKey} lang={lang} pendingPaths={pendingPaths} errorPaths={errorPaths} onTreeFilePathsChange={onTreeFilePathsChange} onSelectFile={onOpenFile} onTreeRefresh={onRefresh} onEntriesDeleted={onEntriesDeleted}/>)}
      </div>
    </aside>);
}
