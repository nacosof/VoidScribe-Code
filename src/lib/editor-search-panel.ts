import { closeSearchPanel, findNext, findPrevious, getSearchQuery, search, searchKeymap, setSearchQuery, SearchQuery, } from "@codemirror/search";
import { Prec } from "@codemirror/state";
import type { Panel, ViewUpdate } from "@codemirror/view";
import { EditorView, keymap } from "@codemirror/view";
function iconBtn(label: string, title: string, onClick: () => void, className = ""): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vs-search__btn ${className}`.trim();
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.textContent = label;
    btn.addEventListener("click", (event) => {
        event.preventDefault();
        onClick();
    });
    return btn;
}
class VsCodeSearchPanel implements Panel {
    readonly dom: HTMLElement;
    readonly top = true;
    private readonly view: EditorView;
    private query: SearchQuery;
    private readonly searchField: HTMLInputElement;
    private readonly statusEl: HTMLElement;
    private readonly caseBtn: HTMLButtonElement;
    private readonly wordBtn: HTMLButtonElement;
    private readonly reBtn: HTMLButtonElement;
    constructor(view: EditorView) {
        this.view = view;
        this.query = getSearchQuery(view.state);
        this.commit = this.commit.bind(this);
        this.keydown = this.keydown.bind(this);
        this.searchField = document.createElement("input");
        this.searchField.type = "text";
        this.searchField.className = "vs-search__input";
        this.searchField.placeholder = "Find";
        this.searchField.setAttribute("aria-label", "Find");
        this.searchField.value = this.query.search;
        this.searchField.addEventListener("input", this.commit);
        this.searchField.addEventListener("change", this.commit);
        this.caseBtn = iconBtn("Aa", "Match case", () => this.toggle("case"));
        this.wordBtn = iconBtn("ab", "Match whole word", () => this.toggle("word"));
        this.reBtn = iconBtn(".*", "Use regular expression", () => this.toggle("re"));
        this.statusEl = document.createElement("span");
        this.statusEl.className = "vs-search__status";
        const toggles = document.createElement("div");
        toggles.className = "vs-search__toggles";
        toggles.append(this.caseBtn, this.wordBtn, this.reBtn);
        const nav = document.createElement("div");
        nav.className = "vs-search__nav";
        nav.append(iconBtn("↑", "Previous match", () => findPrevious(view)), iconBtn("↓", "Next match", () => findNext(view)), iconBtn("×", "Close", () => closeSearchPanel(view), "vs-search__btn--close"));
        this.dom = document.createElement("div");
        this.dom.className = "vs-search-panel";
        this.dom.addEventListener("keydown", this.keydown);
        this.dom.append(this.searchField, toggles, this.statusEl, nav);
        this.syncUi();
    }
    private toggle(kind: "case" | "word" | "re") {
        const next = new SearchQuery({
            search: this.searchField.value,
            caseSensitive: kind === "case" ? !this.query.caseSensitive : this.query.caseSensitive,
            wholeWord: kind === "word" ? !this.query.wholeWord : this.query.wholeWord,
            regexp: kind === "re" ? !this.query.regexp : this.query.regexp,
            replace: this.query.replace,
        });
        this.query = next;
        this.view.dispatch({ effects: setSearchQuery.of(next) });
        this.syncUi();
    }
    private commit() {
        const next = new SearchQuery({
            search: this.searchField.value,
            caseSensitive: this.query.caseSensitive,
            wholeWord: this.query.wholeWord,
            regexp: this.query.regexp,
            replace: this.query.replace,
        });
        if (!next.eq(this.query)) {
            this.query = next;
            this.view.dispatch({ effects: setSearchQuery.of(next) });
        }
        this.syncUi();
    }
    private syncUi() {
        this.caseBtn.classList.toggle("vs-search__toggle--active", this.query.caseSensitive);
        this.wordBtn.classList.toggle("vs-search__toggle--active", this.query.wholeWord);
        this.reBtn.classList.toggle("vs-search__toggle--active", this.query.regexp);
        const text = this.query.search.trim();
        this.statusEl.textContent = text ? "" : "";
    }
    private keydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault();
            (event.shiftKey ? findPrevious : findNext)(this.view);
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            closeSearchPanel(this.view);
        }
    }
    mount() {
        this.searchField.focus();
        this.searchField.select();
    }
    update(update: ViewUpdate) {
        for (const tr of update.transactions) {
            for (const effect of tr.effects) {
                if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
                    this.query = effect.value;
                    this.searchField.value = effect.value.search;
                    this.syncUi();
                }
            }
        }
    }
}
export function createVsCodeSearchPanel(view: EditorView): Panel {
    return new VsCodeSearchPanel(view);
}
export const editorSearchExtension = search({
    createPanel: createVsCodeSearchPanel,
    top: true,
});
export const editorSearchKeymap = Prec.high(keymap.of(searchKeymap));
