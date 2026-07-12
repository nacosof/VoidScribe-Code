export type AgentToolImage = {
  mediaType: "image/png";
  base64: string;
};

export type AgentToolResult = {
  text: string;
  images?: AgentToolImage[];
};

export function toolText(text: string): AgentToolResult {
  return { text };
}

export function toolTextWithImages(
  text: string,
  images: AgentToolImage[]
): AgentToolResult {
  return images.length > 0 ? { text, images } : { text };
}

type AnthropicImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png";
    data: string;
  };
};

type AnthropicTextBlock = { type: "text"; text: string };

export function toAnthropicToolResultContent(
  result: AgentToolResult
): string | Array<AnthropicTextBlock | AnthropicImageBlock> {
  if (!result.images?.length) return result.text;

  return [
    { type: "text", text: result.text },
    ...result.images.map((image) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: image.mediaType,
        data: image.base64,
      },
    })),
  ];
}

export type OpenAiVisionPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function toOpenAiVisionFollowUp(
  result: AgentToolResult
): OpenAiVisionPart[] | null {
  if (!result.images?.length) return null;

  return [
    {
      type: "text",
      text: `${result.text}\n\nОцени скриншот визуально и доработай UI при необходимости.`,
    },
    ...result.images.map((image) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${image.mediaType};base64,${image.base64}`,
      },
    })),
  ];
}
