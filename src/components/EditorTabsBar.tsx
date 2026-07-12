import type { EditorTab } from "@/hooks/useEditorTabs";
import { isEditorTabDirty } from "@/hooks/useEditorTabs";
type Props = {
    tabs: EditorTab[];
    activeId: string | null;
    setActiveId: (id: string) => void;
    closeTab: (id: string) => void;
    titleForPath: (path: string, allPaths: string[]) => string;
};
export function EditorTabsBar({ tabs, activeId, setActiveId, closeTab, titleForPath, }: Props) {
    const paths = tabs.map((tab) => tab.path);
    return (<div className="chat-tabs editor-tabs">
      <div className="chat-tabs__list">
        {tabs.map((tab) => (<div key={tab.id} className={`chat-tab${tab.id === activeId ? " chat-tab--active" : ""}`}>
            <button type="button" className="chat-tab__label" onClick={() => setActiveId(tab.id)}>
              <span className="chat-tab__title">{titleForPath(tab.path, paths)}</span>
              {isEditorTabDirty(tab) ? (<span className="chat-tab__dirty">●</span>) : null}
            </button>
            <button type="button" className="chat-tab__close" aria-label="Close tab" onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
            }}>
              ×
            </button>
          </div>))}
      </div>
    </div>);
}
