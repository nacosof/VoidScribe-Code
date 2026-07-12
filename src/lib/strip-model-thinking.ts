/** Strip chain-of-thought / reasoning blocks models embed in text output. */
export function stripModelThinking(text: string): string {
    let result = text;
    result = result.replace(/<(?:redacted_)?think(?:ing)?>[\s\S]*?<\/(?:redacted_)?think(?:ing)?>/gi, "");
    result = result.replace(/<(?:redacted_)?think(?:ing)?>[\s\S]*/gi, "");
    result = result.replace(/<\|think\|>[\s\S]*?<\|\/think\|>/gi, "");
    result = result.replace(/<\|think\|>[\s\S]*/gi, "");
    return result.trim();
}

function stripCodeFences(text: string): string {
    const trimmed = text.trim();
    const fenced = /^```[\w-]*\n?([\s\S]*?)```$/m.exec(trimmed);
    if (fenced)
        return fenced[1].replace(/\n$/, "");
    return trimmed.replace(/\n$/, "");
}

function pickCodeTail(text: string, originalSelection: string): string {
    const lines = text.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim());
    if (!lines.length)
        return text.trim();
    const proseStart = /^(okay|wait|hmm|so,|the user|let me|but |however|given |in any case|perhaps|alternatively|if the)/i;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i].trim();
        if (!line || proseStart.test(line))
            continue;
        if (line.length <= Math.max(originalSelection.length * 4, 512))
            return line;
    }
    const last = lines[lines.length - 1]?.trim() ?? text.trim();
    return last;
}

export function stripQuickEditResponse(text: string, originalSelection = ""): string {
    let cleaned = stripModelThinking(text);
    const afterThinkClose = text.split(/<\/(?:redacted_)?think(?:ing)?>/i).pop();
    if (afterThinkClose && afterThinkClose.trim() !== text.trim()) {
        cleaned = stripModelThinking(afterThinkClose);
    }
    cleaned = stripCodeFences(cleaned);
    const looksLikeProse = /\b(the user|let me see|according to the rules|this is confusing)\b/i.test(cleaned);
    const tooLong = cleaned.length > Math.max(originalSelection.length * 6, 400);
    if (looksLikeProse || tooLong)
        cleaned = pickCodeTail(cleaned, originalSelection);
    return cleaned.trim();
}

export function looksLikeThinkingLeak(text: string): boolean {
    return /<(?:redacted_)?think(?:ing)?>/i.test(text)
        || /\b(let me see|the user wants|according to the rules)\b/i.test(text);
}
