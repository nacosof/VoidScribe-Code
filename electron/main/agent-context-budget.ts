import type OpenAI from "openai";
import { resolveInputCharBudget } from "../../src/lib/model-capabilities";
import type { UserAiProviderId } from "../../src/lib/providers";
import type { OpenAiMessage } from "./agent-tools";
const TRIM_TO_LEN = 140;
export function estimateMessagesChars(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): number {
    try {
        return JSON.stringify(messages).length;
    }
    catch {
        let total = 0;
        for (const message of messages) {
            total += messageTextLength(message as OpenAiMessage);
        }
        return total;
    }
}
function messageTextLength(message: OpenAiMessage): number {
    const content = message.content;
    if (typeof content === "string")
        return content.length;
    if (Array.isArray(content)) {
        return content
            .map((part) => {
            if (part.type === "text" && "text" in part)
                return part.text.length;
            if (part.type === "image_url")
                return 400;
            return 0;
        })
            .reduce((sum, n) => sum + n, 0);
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
        return JSON.stringify(message.tool_calls).length;
    }
    return 0;
}
function getMessageText(message: OpenAiMessage): string {
    const content = message.content;
    if (typeof content === "string")
        return content;
    if (Array.isArray(content)) {
        return content
            .filter((part) => part.type === "text" && "text" in part)
            .map((part) => (part as {
            text: string;
        }).text)
            .join("\n");
    }
    return "";
}
function setMessageText(message: OpenAiMessage, text: string): void {
    const content = message.content;
    if (typeof content === "string" || content == null) {
        message.content = text;
        return;
    }
    if (Array.isArray(content)) {
        const rest = content.filter((part) => part.type !== "text");
        message.content = (text.trim().length > 0 ? [{ type: "text", text }, ...rest] : rest.length > 0 ? rest : text) as OpenAiMessage["content"];
    }
}
function truncateText(text: string, limit: number, note: string): string {
    if (text.length <= limit)
        return text;
    return `${text.slice(0, limit)}\n\nвЂ¦ ${note}`;
}
export function trimWorkspaceSnapshotInSystem(systemContent: string, maxSnapshotChars = 3500): string {
    const start = systemContent.indexOf("--- РЎРѕСЃС‚РѕСЏРЅРёРµ РѕС‚РєСЂС‹С‚РѕР№ СЂР°Р±РѕС‡РµР№ РїР°РїРєРё ---");
    if (start < 0)
        return systemContent;
    const end = systemContent.indexOf("--- РєРѕРЅРµС† СЃРЅРёРјРєР° ---", start);
    if (end < 0)
        return systemContent;
    const blockEnd = end + "--- РєРѕРЅРµС† СЃРЅРёРјРєР° ---".length;
    const block = systemContent.slice(start, blockEnd);
    if (block.length <= maxSnapshotChars)
        return systemContent;
    const trimmed = truncateText(block, maxSnapshotChars, "(СЃРЅРёРјРѕРє РїР°РїРєРё СЃРѕРєСЂР°С‰С‘РЅ вЂ” list_directory РїСЂРё РЅСѓР¶РґРµ)");
    return systemContent.slice(0, start) + trimmed + systemContent.slice(blockEnd);
}
export function weightBasedTrimMessages(messages: OpenAiMessage[], charBudget: number): boolean {
    const trimmableIndexes: number[] = [];
    for (let index = 0; index < messages.length; index += 1) {
        const role = messages[index]?.role;
        if (role === "system")
            continue;
        if (role === "tool" || role === "assistant" || role === "user") {
            trimmableIndexes.push(index);
        }
    }
    if (trimmableIndexes.length === 0)
        return false;
    const alreadyTrimmed = new Set<number>();
    const weight = (index: number): number => {
        const message = messages[index];
        if (!message)
            return 0;
        const base = messageTextLength(message);
        if (base <= TRIM_TO_LEN)
            return 0;
        let multiplier = 1 + (messages.length - 1 - index) / messages.length;
        if (message.role === "user") {
            multiplier *= 1;
        }
        else if (message.role === "system") {
            multiplier *= 0.01;
        }
        else {
            multiplier *= 10;
        }
        if (alreadyTrimmed.has(index))
            multiplier = 0;
        if (index <= 1 || index >= messages.length - 4) {
            multiplier *= 0.05;
        }
        return base * multiplier;
    };
    const findLargest = (): number => {
        let best = -1;
        let bestWeight = -Infinity;
        for (const index of trimmableIndexes) {
            const w = weight(index);
            if (w > bestWeight) {
                bestWeight = w;
                best = index;
            }
        }
        return best;
    };
    let totalLen = 0;
    for (const message of messages) {
        totalLen += messageTextLength(message);
    }
    const minKeep = Math.min(charBudget, 5000);
    let remaining = totalLen - minKeep;
    if (remaining <= 0)
        return false;
    let changed = false;
    let guard = 0;
    while (remaining > 0 && guard < 120) {
        guard += 1;
        const trimIdx = findLargest();
        if (trimIdx < 0)
            break;
        const message = messages[trimIdx];
        if (!message)
            break;
        const text = getMessageText(message);
        if (text.length <= TRIM_TO_LEN) {
            alreadyTrimmed.add(trimIdx);
            continue;
        }
        const trimAmount = text.length - TRIM_TO_LEN;
        if (trimAmount > remaining) {
            const next = `${text.slice(0, text.length - remaining - 3).trim()}...`;
            setMessageText(message, next);
            changed = true;
            break;
        }
        remaining -= trimAmount;
        setMessageText(message, `${text.slice(0, TRIM_TO_LEN - 3)}...`);
        alreadyTrimmed.add(trimIdx);
        changed = true;
    }
    return changed;
}
function truncateToolMessages(messages: OpenAiMessage[], keepRecent: number, maxChars: number): void {
    const toolIndexes: number[] = [];
    for (let index = 0; index < messages.length; index += 1) {
        if (messages[index]?.role === "tool")
            toolIndexes.push(index);
    }
    const trimSet = new Set(toolIndexes.slice(0, Math.max(0, toolIndexes.length - keepRecent)));
    for (const index of toolIndexes) {
        const message = messages[index];
        if (!message || message.role !== "tool")
            continue;
        const content = typeof message.content === "string" ? message.content : "";
        if (trimSet.has(index)) {
            message.content = truncateText(content, 160, "(СЃС‚Р°СЂС‹Р№ С€Р°Рі СЃРѕРєСЂР°С‰С‘РЅ)");
            continue;
        }
        if (content.length > maxChars) {
            message.content = truncateText(content, maxChars, "(СЃРѕРєСЂР°С‰РµРЅРѕ РґР»СЏ Р»РёРјРёС‚Р° РєРѕРЅС‚РµРєСЃС‚Р°)");
        }
    }
}
function dropMiddleAssistantRounds(messages: OpenAiMessage[], keepTail: number): void {
    const assistantIndexes: number[] = [];
    for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (message?.role === "assistant" && message.tool_calls?.length) {
            assistantIndexes.push(index);
        }
    }
    const dropCount = Math.max(0, assistantIndexes.length - keepTail);
    if (dropCount <= 0)
        return;
    const dropFrom = new Set(assistantIndexes.slice(0, dropCount));
    const dropToolIds = new Set<string>();
    for (const index of dropFrom) {
        const message = messages[index];
        if (!message || message.role !== "assistant")
            continue;
        for (const call of message.tool_calls ?? []) {
            if (call.id)
                dropToolIds.add(call.id);
        }
    }
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message)
            continue;
        if (message.role === "assistant" && dropFrom.has(index)) {
            messages.splice(index, 1);
            continue;
        }
        if (message.role === "tool" &&
            message.tool_call_id &&
            dropToolIds.has(message.tool_call_id)) {
            messages.splice(index, 1);
        }
    }
    const system = messages[0];
    if (system?.role === "system" && typeof system.content === "string") {
        const note = "[РЎРєСЂС‹С‚Рѕ СЂР°РЅРЅРёРµ С€Р°РіРё Р°РіРµРЅС‚Р° вЂ” РєРѕРЅС‚РµРєСЃС‚ СЃРѕРєСЂР°С‰С‘РЅ. read_file / list_directory РїСЂРё РЅСѓР¶РґРµ.]\n\n";
        if (!system.content.includes(note.trim())) {
            system.content = note + system.content;
        }
    }
}
export type CompactMessagesOptions = {
    model?: string;
    aggressive?: boolean;
};
export function compactMessagesForApi(messages: OpenAiMessage[], provider: UserAiProviderId, options?: CompactMessagesOptions): boolean {
    const model = options?.model?.trim() ?? "";
    const budget = resolveInputCharBudget(provider, model);
    const aggressive = options?.aggressive === true;
    let changed = false;
    const system = messages[0];
    if (system?.role === "system" && typeof system.content === "string") {
        const trimmed = trimWorkspaceSnapshotInSystem(system.content, aggressive ? 2000 : 3500);
        if (trimmed !== system.content) {
            system.content = trimmed;
            changed = true;
        }
    }
    truncateToolMessages(messages, aggressive ? 4 : 8, aggressive ? 600 : 1000);
    changed = true;
    if (weightBasedTrimMessages(messages, budget)) {
        changed = true;
    }
    if (estimateMessagesChars(messages) > budget) {
        dropMiddleAssistantRounds(messages, aggressive ? 2 : 4);
        changed = true;
    }
    if (estimateMessagesChars(messages) > budget) {
        weightBasedTrimMessages(messages, Math.floor(budget * 0.85));
        truncateToolMessages(messages, aggressive ? 2 : 4, aggressive ? 320 : 600);
        changed = true;
    }
    return changed;
}
export function isLikelyContextOverflow400(err: unknown): boolean {
    if (err instanceof Error && "status" in err) {
        const status = (err as {
            status?: number;
        }).status;
        if (status === 400)
            return true;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return (/\b400\b/.test(msg) &&
        !/tool_use_failed|function call/i.test(msg));
}
