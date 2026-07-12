import type { ChatSession } from "@/types";
export function createId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
export function createChatSession(title = "New chat"): ChatSession {
    const now = Date.now();
    return {
        id: createId(),
        title,
        messages: [],
        checkpoints: [],
        createdAt: now,
        updatedAt: now,
    };
}
export function titleFromPrompt(prompt: string): string {
    return prompt.trim().split(/\s+/).slice(0, 6).join(" ") || "New chat";
}
