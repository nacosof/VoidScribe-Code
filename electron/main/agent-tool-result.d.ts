export type AgentToolImage = {
    mediaType: string;
    data: string;
};
export type AgentToolResult = {
    ok?: boolean;
    text: string;
    images?: AgentToolImage[];
};
export declare function toolText(text: string, ok?: boolean): AgentToolResult;
export declare function toolTextWithImages(text: string, images: AgentToolImage[]): AgentToolResult;
export declare function toOpenAiVisionFollowUp(result: AgentToolResult): Array<{
    type: "text";
    text: string;
} | {
    type: "image_url";
    image_url: {
        url: string;
    };
}> | null;
export declare function toAnthropicToolResultContent(result: AgentToolResult): string;
