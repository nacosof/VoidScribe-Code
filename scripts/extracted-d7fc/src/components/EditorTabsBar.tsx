import type { EditorTab } from "@/hooks/useEditorTabs";
import { handleHorizontalWheel } from "@/lib/horizontal-scroll";

type EditorTabsBarProps = {
  tabs: EditorTab[];
  activeId: string | null;
  fileNameFromPath: (path: string) => string;
  isTabDirty: (tabId: string) => boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
};

function FileTabIcon() {
  return (
    <svg
      className="chat-tab__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function EditorTabsBar({
  tabs,
  activeId,
  fileNameFromPath,
  isTabDirty,
  onSelect,
  onClose,
}: EditorTabsBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="chat-tabs">
      <div className="chat-tabs__list" onWheel={handleHorizontalWheel}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          const dirty = isTabDirty(tab.id);
          const title = fileNameFromPath(tab.path);

          return (
            <div
              key={tab.id}
              className={`chat-tab${isActive ? " chat-tab--active" : ""}`}
            >
              <button
                type="button"
                className="chat-tab__label"
                onClick={() => onSelect(tab.id)}
                title={tab.path}
              >
                <FileTabIcon />
                <span className="chat-tab__title">{title}</span>
                {dirty ? (
                  <span className="chat-tab__dirty" aria-label="Несохранено">
                    ●
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="chat-tab__close"
                onClick={() => onClose(tab.id)}
                aria-label={`Закрыть «${title}»`}
                title="Закрыть"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
