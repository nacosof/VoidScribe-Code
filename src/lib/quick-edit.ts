import { createId } from "@/lib/chat-sessions";
import type { EditorSelectionInfo } from "@/lib/editor-selection";
import { looksLikeThinkingLeak, stripQuickEditResponse } from "@/lib/strip-model-thinking";
import type { UiLanguage } from "@/types";

function buildQuickEditPrompt(selection: EditorSelectionInfo, instruction: string, lang: UiLanguage): string {
    const rules = lang === "en"
        ? `You are a precise code editing assistant. Apply ONLY the requested change to the selected fragment.

Rules:
- Return ONLY the replacement code for the selected fragment — one snippet, nothing else
- NO thinking tags, NO reasoning, NO markdown fences, NO explanation
- Preserve indentation style
- Do not include code outside the selection`
        : `Ты точный ассистент по правке кода. Примени ТОЛЬКО запрошенное изменение к выделенному фрагменту.

Правила:
- Верни ТОЛЬКО новый код фрагмента — один фрагмент, больше ничего
- БЕЗ think/reasoning-тегов, БЕЗ markdown, БЕЗ пояснений
- Сохрани стиль отступов
- Не добавляй код вне выделения`;
    const fileLabel = lang === "en" ? "File" : "Файл";
    const linesLabel = lang === "en" ? "Lines" : "Строки";
    const selectedLabel = lang === "en" ? "Selected code" : "Выделенный код";
    const instructionLabel = lang === "en" ? "User instruction" : "Запрос пользователя";
    return `${rules}

${fileLabel}: ${selection.path}
${linesLabel}: ${selection.startLine}-${selection.endLine}

${selectedLabel}:
\`\`\`
${selection.text}
\`\`\`

${instructionLabel}: ${instruction.trim()}`;
}

export { stripQuickEditResponse, looksLikeThinkingLeak };

export async function runQuickEditStream(input: {
    selection: EditorSelectionInfo;
    instruction: string;
    lang: UiLanguage;
    signal?: AbortSignal;
    onDelta?: (text: string) => void;
}): Promise<string> {
    const requestId = createId();
    let content = "";
    let settled = false;
    let resolveDone!: () => void;
    let rejectDone!: (err: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
    });
    const offDelta = window.voidscribe.onChatDelta(({ requestId: rid, delta }) => {
        if (rid !== requestId)
            return;
        content += delta;
        input.onDelta?.(content);
    });
    const offDone = window.voidscribe.onChatDone(({ requestId: rid }) => {
        if (rid !== requestId || settled)
            return;
        settled = true;
        resolveDone();
    });
    const offError = window.voidscribe.onChatError(({ requestId: rid, error }) => {
        if (rid !== requestId || settled)
            return;
        settled = true;
        rejectDone(new Error(error));
    });
    const onAbort = () => {
        if (settled)
            return;
        settled = true;
        void window.voidscribe.cancelChat(requestId);
        rejectDone(new Error("cancelled"));
    };
    input.signal?.addEventListener("abort", onAbort, { once: true });
    try {
        const result = await window.voidscribe.streamChat({
            requestId,
            messages: [{
                id: createId(),
                role: "user",
                content: buildQuickEditPrompt(input.selection, input.instruction, input.lang),
                createdAt: Date.now(),
                mode: "normal",
            }],
            mode: "normal",
        });
        if (!result.ok && !settled) {
            settled = true;
            throw new Error(result.error);
        }
        await done;
        if (input.signal?.aborted)
            throw new Error("cancelled");
        const cleaned = stripQuickEditResponse(content, input.selection.text);
        if (!cleaned.trim())
            throw new Error("empty");
        if (looksLikeThinkingLeak(cleaned))
            throw new Error("thinking_leak");
        return cleaned;
    }
    finally {
        offDelta();
        offDone();
        offError();
        input.signal?.removeEventListener("abort", onAbort);
    }
}
