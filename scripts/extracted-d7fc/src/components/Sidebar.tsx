import type { WindowLayout } from "@/types";
import { getWorkspaceFolderName } from "@/lib/workspace-ui";
import { FileExplorer } from "./FileExplorer";

type SidebarProps = {
  workspacePath: string;
  windowLayout: WindowLayout;
  selectedFilePath: string | null;
  onSelectWorkspace: () => void;
  onSelectFile: (path: string) => void;
};

export function Sidebar({
  workspacePath,
  windowLayout,
  selectedFilePath,
  onSelectWorkspace,
  onSelectFile,
}: SidebarProps) {
  const hasWorkspace = Boolean(workspacePath.trim());
  const folderName = getWorkspaceFolderName(workspacePath);

  return (
    <aside className="sidebar">
      <div className="sidebar__body">
        {!hasWorkspace ? (
          <div className="sidebar__section">
            <span className="sidebar__label">Проект</span>
            <p className="sidebar__hint">
              Выберите папку проекта, чтобы агенты и редактор могли с ней
              работать.
            </p>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ width: "100%", marginTop: 8 }}
              onClick={onSelectWorkspace}
            >
              Выбрать папку
            </button>
          </div>
        ) : windowLayout === "editor" ? (
          <FileExplorer
            workspacePath={workspacePath}
            selectedPath={selectedFilePath}
            onSelectFile={onSelectFile}
          />
        ) : (
          <div className="sidebar__section sidebar__section--agent">
            <p className="sidebar__agent-status">
              Агенты работают над:{" "}
              <span className="sidebar__agent-folder">{folderName}</span>
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
