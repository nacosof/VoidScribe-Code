import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatMessage } from "../../src/types";
import type { UserAiProviderId } from "../../src/lib/providers";
import { modelSupportsVision } from "../../src/lib/model-vision";
import { buildUserMessageContent } from "../../src/lib/chat-context";
export type ChatVisionOptions = {
    provider?: UserAiProviderId;
    model?: string;
};
export function chatHistoryToOpenAiMessages(history: ChatMessage[], options?: ChatVisionOptions): ChatCompletionMessageParam[] {
    const supportsVision = options?.provider && options?.model ? modelSupportsVision(options.provider, options.model) : false;
    return history
        .filter((message) => message.role !== "assistant" || message.content.trim())
        .map((message) => {
        if (message.role === "assistant")
            return { role: "assistant", content: message.content } as ChatCompletionMessageParam;
        const text = buildUserMessageContent(message.content, message.contextRefs ?? []);
        const images = message.images ?? [];
        if (images.length && supportsVision) {
            const body = text.trim() || " ";
            return {
                role: "user",
                content: [
                    { type: "text", text: body },
                    ...images.map((image) => ({
                        type: "image_url" as const,
                        image_url: { url: image.dataUrl },
                    })),
                ],
            } as ChatCompletionMessageParam;
        }
        return { role: "user", content: text } as ChatCompletionMessageParam;
    });
}
