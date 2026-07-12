import type { IDisposable, ILink, Terminal } from "@xterm/xterm";
const URL_IN_TEXT_RE = /https?:\/\/[^\s"'<>()[\]{}|\\^`]+|(?:localhost|127\.0\.0\.1):\d{2,5}(?:\/[^\s"'<>]*)?/gi;
type TextSpan = {
    text: string;
    columns: number[];
};
function buildLineTextSpans(line: NonNullable<ReturnType<Terminal["buffer"]["active"]["getLine"]>>): TextSpan {
    let text = "";
    const columns: number[] = [];
    for (let col = 0; col < line.length; col++) {
        const cell = line.getCell(col);
        if (!cell)
            continue;
        const chars = cell.getChars();
        if (!chars)
            continue;
        for (let i = 0; i < chars.length; i++) {
            text += chars[i];
            columns.push(col + 1);
        }
    }
    return { text, columns };
}
function normalizeTerminalHref(uri: string): string | null {
    const cleaned = uri.trim();
    if (!cleaned)
        return null;
    if (/^https?:\/\//i.test(cleaned))
        return cleaned;
    if (/^(?:localhost|127\.0\.0\.1):\d{2,5}/i.test(cleaned)) {
        return `http://${cleaned}`;
    }
    return null;
}
function findUrlsInLine(span: TextSpan): Array<{
    raw: string;
    startCol: number;
    endCol: number;
}> {
    const matches: Array<{
        raw: string;
        startCol: number;
        endCol: number;
    }> = [];
    const regex = new RegExp(URL_IN_TEXT_RE.source, URL_IN_TEXT_RE.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(span.text)) !== null) {
        const raw = match[0];
        const href = normalizeTerminalHref(raw);
        if (!href)
            continue;
        const startIndex = match.index;
        const endIndex = startIndex + raw.length - 1;
        const startCol = span.columns[startIndex];
        const endCol = span.columns[endIndex];
        if (!startCol || !endCol)
            continue;
        matches.push({ raw, startCol, endCol });
    }
    return matches;
}
export function openTerminalLink(event: globalThis.MouseEvent, uri: string): void {
    event.preventDefault();
    event.stopPropagation();
    const href = normalizeTerminalHref(uri);
    if (!href)
        return;
    void window.voidscribe.openExternal(href);
}
function createLink(bufferLineNumber: number, raw: string, startCol: number, endCol: number): ILink {
    return {
        text: raw,
        range: {
            start: { x: startCol, y: bufferLineNumber },
            end: { x: endCol, y: bufferLineNumber },
        },
        decorations: {
            underline: true,
            pointerCursor: true,
        },
        activate: (event, linkText) => openTerminalLink(event, linkText || raw),
    };
}
function findUrlAtCoords(term: Terminal, bufferLine: number, column: number): string | null {
    const line = term.buffer.active.getLine(bufferLine);
    if (!line)
        return null;
    const span = buildLineTextSpans(line);
    for (const found of findUrlsInLine(span)) {
        if (column >= found.startCol && column <= found.endCol) {
            return found.raw;
        }
    }
    return null;
}
function coordsFromMouseEvent(term: Terminal, element: HTMLElement, event: MouseEvent): {
    x: number;
    y: number;
} | null {
    const screen = element.querySelector<HTMLElement>(".xterm-screen");
    if (!screen)
        return null;
    const rect = screen.getBoundingClientRect();
    const cellWidth = rect.width / term.cols;
    const cellHeight = rect.height / term.rows;
    if (!cellWidth || !cellHeight)
        return null;
    const relX = event.clientX - rect.left;
    const relY = event.clientY - rect.top;
    const x = Math.min(term.cols, Math.max(1, Math.ceil(relX / cellWidth)));
    const y = Math.min(term.rows, Math.max(1, Math.ceil(relY / cellHeight)));
    return { x, y };
}
export function attachTerminalLinks(term: Terminal): IDisposable[] {
    const disposables: IDisposable[] = [];
    disposables.push(term.registerLinkProvider({
        provideLinks(bufferLineNumber, callback) {
            const line = term.buffer.active.getLine(bufferLineNumber - 1);
            if (!line) {
                callback(undefined);
                return;
            }
            const span = buildLineTextSpans(line);
            const found = findUrlsInLine(span);
            callback(found.length
                ? found.map(({ raw, startCol, endCol }) => createLink(bufferLineNumber, raw, startCol, endCol))
                : undefined);
        },
    }));
    const onMouseUp = (event: MouseEvent) => {
        if (event.button !== 0)
            return;
        const element = term.element;
        if (!element)
            return;
        const coords = coordsFromMouseEvent(term, element, event);
        if (!coords)
            return;
        const bufferLine = term.buffer.active.viewportY + coords.y - 1;
        const url = findUrlAtCoords(term, bufferLine, coords.x);
        if (!url)
            return;
        openTerminalLink(event, url);
    };
    const attachMouseHandler = () => {
        const element = term.element;
        if (!element)
            return;
        element.addEventListener("mouseup", onMouseUp);
        disposables.push({
            dispose() {
                element.removeEventListener("mouseup", onMouseUp);
            },
        });
    };
    attachMouseHandler();
    if (!term.element) {
        const timer = window.setTimeout(attachMouseHandler, 0);
        disposables.push({
            dispose() {
                window.clearTimeout(timer);
            },
        });
    }
    return disposables;
}
