export function insertNewlineAtCursor(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { value: string; caret: number } {
  const caret = selectionStart + 1;
  return {
    value: value.slice(0, selectionStart) + "\n" + value.slice(selectionEnd),
    caret,
  };
}
