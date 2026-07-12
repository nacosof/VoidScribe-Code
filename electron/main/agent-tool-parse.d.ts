import type OpenAI from "openai";
type RawToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
export declare function resolveAssistantToolCalls(input: {
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: RawToolCall[];
    function_call?: {
        name?: string;
        arguments?: string;
    };
}): {
    visibleText: string;
    toolCalls: RawToolCall[];
    truncatedInlineTool: boolean;
};
export declare function peekTruncatedWriteFilePath(text: string): string | null;
export {};
