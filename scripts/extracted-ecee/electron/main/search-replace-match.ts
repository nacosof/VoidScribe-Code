export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function stripTrailingSpacesPerLine(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");
}

function needleVariants(oldString: string): string[] {
  const trimmed = oldString.trim();
  const variants = [
    oldString,
    trimmed,
    oldString.replace(/\r\n/g, "\n"),
    oldString.replace(/\n/g, "\r\n"),
    trimmed.replace(/\r\n/g, "\n"),
    trimmed.replace(/\n/g, "\r\n"),
    stripTrailingSpacesPerLine(oldString),
    stripTrailingSpacesPerLine(trimmed),
  ];
  const seen = new Set<string>();
  return variants.filter((item) => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

/** Ищет old_string с терпимостью к CRLF и хвостовым пробелам (как Cursor). */
export function resolveSearchNeedle(
  content: string,
  oldString: string
): { needle: string; count: number } | null {
  for (const needle of needleVariants(oldString)) {
    const count = countOccurrences(content, needle);
    if (count > 0) return { needle, count };
  }
  return null;
}

export function applySearchReplace(input: {
  content: string;
  needle: string;
  newString: string;
  replaceAll: boolean;
  matchCount: number;
}): { nextContent: string; replaced: number; note?: string } {
  const { content, needle, newString, replaceAll, matchCount } = input;

  if (replaceAll || matchCount <= 1) {
    const nextContent = replaceAll
      ? content.split(needle).join(newString)
      : content.replace(needle, newString);
    const replaced = replaceAll ? matchCount : Math.min(1, matchCount);
    return { nextContent, replaced };
  }

  const nextContent = content.replace(needle, newString);
  return {
    nextContent,
    replaced: 1,
    note:
      `Заменено 1 из ${matchCount} вхождений. ` +
      `Чтобы заменить все — replace_all: true или расширь old_string.`,
  };
}
