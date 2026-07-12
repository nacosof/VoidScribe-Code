import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatMessage } from "../../src/types";

export function toOpenAiUserMessageContent(
  message: ChatMessage
): string | ChatCompletionContentPart[] {
  const images = message.images ?? [];
  if (!images.length) return message.content;

  const parts: ChatCompletionContentPart[] = [];
  const text = message.content.trim();
  if (text) {
    parts.push({ type: "text", text: message.content });
  }

  for (const image of images) {
    parts.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mediaType};base64,${image.base64}`,
      },
    });
  }

  return parts.length > 0 ? parts : message.content;
}

export function chatHistoryToOpenAiMessages(
  history: ChatMessage[]
): ChatCompletionMessageParam[] {
  return history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      if (message.role === "user" && message.images?.length) {
        return {
          role: "user" as const,
          content: toOpenAiUserMessageContent(message),
        };
      }
      return {
        role: message.role,
        content: message.content,
      };
    });
}
