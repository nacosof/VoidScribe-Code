import type { EditorState } from "@codemirror/state";
import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  selectMatches,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorView, Panel } from "@codemirror/view";

function matchStatus(state: EditorState, query: SearchQuery): string {
  if (!query.search.trim()) return "";
  if (!query.valid) return "Ошибка";

  const matches: Array<{ from: number; to: number }> = [];
  const cursor = query.getCursor(state);
  let step = cursor.next();
  while (!step.done) {
    matches.push(step.value);
    step = cursor.next();
  }

  if (matches.length === 0) return "Нет результатов";

  const sel = state.selection.main;
  let index = matches.findIndex(
    (match) => match.from === sel.from && match.to === sel.to
  );
  if (index < 0) {
    index = matches.findIndex(
      (match) => match.from <= sel.from && sel.from <= match.to
    );
  }
  if (index < 0) return String(matches.length);
  return `${index + 1} из ${matches.length}`;
}

function iconButton(
  label: string,
  title: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vs-search-panel__icon-btn";
  btn.setAttribute("aria-label", title);
  btn.title = title;
  btn.textContent = label;
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  return btn;
}

function toggleButton(
  label: string,
  title: string,
  active: boolean,
  onToggle: () => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `vs-search-panel__opt${active ? " vs-search-panel__opt--active" : ""}`;
  btn.setAttribute("aria-label", title);
  btn.title = title;
  btn.setAttribute("aria-pressed", active ? "true" : "false");
  btn.textContent = label;
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    onToggle();
  });
  return btn;
}

class CursorSearchPanel implements Panel {
  private view: EditorView;
  private query: SearchQuery;
  private replaceOpen = false;

  readonly dom: HTMLElement;
  private searchField: HTMLInputElement;
  private replaceField: HTMLInputElement;
  private replaceRow: HTMLElement;
  private statusEl: HTMLElement;
  private caseBtn: HTMLButtonElement;
  private wordBtn: HTMLButtonElement;
  private reBtn: HTMLButtonElement;
  private expandBtn: HTMLButtonElement;

  constructor(view: EditorView) {
    this.view = view;
    this.query = getSearchQuery(view.state);

    this.searchField = document.createElement("input");
    this.searchField.className = "vs-search-panel__input";
    this.searchField.setAttribute("main-field", "true");
    this.searchField.setAttribute("aria-label", "Найти");
    this.searchField.placeholder = "Find";
    this.searchField.value = this.query.search;
    this.searchField.addEventListener("input", () => this.commit());
    this.searchField.addEventListener("keyup", () => this.commit());

    this.replaceField = document.createElement("input");
    this.replaceField.className = "vs-search-panel__input";
    this.replaceField.setAttribute("aria-label", "Заменить");
    this.replaceField.placeholder = "Replace";
    this.replaceField.value = this.query.replace;
    this.replaceField.addEventListener("input", () => this.commit());
    this.replaceField.addEventListener("keyup", () => this.commit());

    this.statusEl = document.createElement("span");
    this.statusEl.className = "vs-search-panel__status";
    this.statusEl.textContent = matchStatus(view.state, this.query);

    const toggles = document.createElement("div");
    toggles.className = "vs-search-panel__toggles";

    this.caseBtn = toggleButton(
      "Aa",
      "Учитывать регистр",
      this.query.caseSensitive,
      () => this.commit()
    );
    this.wordBtn = toggleButton("ab", "Целое слово", this.query.wholeWord, () =>
      this.commit()
    );
    this.reBtn = toggleButton(".*", "Регулярное выражение", this.query.regexp, () =>
      this.commit()
    );
    toggles.append(this.caseBtn, this.wordBtn, this.reBtn);

    const findWrap = document.createElement("div");
    findWrap.className = "vs-search-panel__find-wrap";
    findWrap.append(this.searchField, toggles);

    this.expandBtn = iconButton("›", "Показать замену", () => {
      this.replaceOpen = !this.replaceOpen;
      this.replaceRow.classList.toggle(
        "vs-search-panel__replace--open",
        this.replaceOpen
      );
      this.expandBtn.textContent = this.replaceOpen ? "‹" : "›";
      this.expandBtn.title = this.replaceOpen ? "Скрыть замену" : "Показать замену";
      if (this.replaceOpen) this.replaceField.focus();
    });
    this.expandBtn.className = "vs-search-panel__expand";

    const row = document.createElement("div");
    row.className = "vs-search-panel__row";
    row.append(
      this.expandBtn,
      findWrap,
      this.statusEl,
      iconButton("↑", "Предыдущее", () => findPrevious(view)),
      iconButton("↓", "Следующее", () => findNext(view)),
      iconButton("≡", "Выделить все", () => selectMatches(view)),
      iconButton("×", "Закрыть", () => closeSearchPanel(view))
    );

    this.replaceRow = document.createElement("div");
    this.replaceRow.className = "vs-search-panel__replace";
    if (!view.state.readOnly) {
      const replaceActions = document.createElement("div");
      replaceActions.className = "vs-search-panel__replace-actions";
      replaceActions.append(
        iconButton("↵", "Заменить", () => replaceNext(view)),
        iconButton("∀", "Заменить все", () => replaceAll(view))
      );
      this.replaceRow.append(this.replaceField, replaceActions);
    }

    this.dom = document.createElement("div");
    this.dom.className = "vs-search-panel cm-search";
    this.dom.addEventListener("keydown", (event) => this.keydown(event));
    this.dom.append(row, this.replaceRow);
  }

  get top(): boolean {
    return true;
  }

  get pos(): number {
    return 100;
  }

  mount(): void {
    this.searchField.focus();
    this.searchField.select();
  }

  update(update: {
    transactions: readonly {
      effects: readonly { is?: (type: unknown) => boolean; value?: unknown }[];
    }[];
  }): void {
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (
          effect?.is?.(setSearchQuery) &&
          effect.value instanceof SearchQuery &&
          !effect.value.eq(this.query)
        ) {
          this.setQuery(effect.value);
        }
      }
    }
    this.statusEl.textContent = matchStatus(this.view.state, this.query);
  }

  private setQuery(query: SearchQuery): void {
    this.query = query;
    this.searchField.value = query.search;
    this.replaceField.value = query.replace;
    this.syncToggle(this.caseBtn, query.caseSensitive);
    this.syncToggle(this.wordBtn, query.wholeWord);
    this.syncToggle(this.reBtn, query.regexp);
    this.statusEl.textContent = matchStatus(this.view.state, query);
  }

  private syncToggle(btn: HTMLButtonElement, active: boolean): void {
    btn.classList.toggle("vs-search-panel__opt--active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }

  private commit(): void {
    const query = new SearchQuery({
      search: this.searchField.value,
      caseSensitive: this.caseBtn.classList.contains("vs-search-panel__opt--active"),
      regexp: this.reBtn.classList.contains("vs-search-panel__opt--active"),
      wholeWord: this.wordBtn.classList.contains("vs-search-panel__opt--active"),
      replace: this.replaceField.value,
    });

    if (!query.eq(this.query)) {
      this.query = query;
      this.view.dispatch({ effects: setSearchQuery.of(query) });
      this.statusEl.textContent = matchStatus(this.view.state, query);
    }
  }

  private keydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && event.target === this.searchField) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(this.view);
      return;
    }
    if (event.key === "Enter" && event.target === this.replaceField) {
      event.preventDefault();
      replaceNext(this.view);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearchPanel(this.view);
    }
  }
}

export function createCursorSearchPanel(view: EditorView): Panel {
  return new CursorSearchPanel(view);
}
