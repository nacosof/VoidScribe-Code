export type AgentToolImage = {
    mediaType: string;
    data: string;
};
export type AgentToolResult = {
    ok?: boolean;
    text: string;
    images?: AgentToolImage[];
};
export function toolText(text: string, ok = true): AgentToolResult {
    return { ok, text };
}
export function toolTextWithImages(text: string, images: AgentToolImage[]): AgentToolResult {
    return { ok: true, text, images };
}
export function toOpenAiVisionFollowUp(result: AgentToolResult): Array<{
    type: "text";
    text: string;
} | {
    type: "image_url";
    image_url: {
        url: string;
    };
}> | null {
    if (!result.images?.length)
        return null;
    return [{ type: "text", text: result.text }, ...result.images.map((image) => ({ type: "image_url" as const, image_url: { url: `data:${image.mediaType};base64,${image.data}` } }))];
}
export function toAnthropicToolResultContent(result: AgentToolResult): string {
    return result.text;
}
