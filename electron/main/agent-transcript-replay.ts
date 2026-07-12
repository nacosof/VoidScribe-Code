import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatMessage } from "../../src/types";
import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
import type { UserAiProviderId } from "../../src/lib/providers";
import { chatHistoryToOpenAiMessages, type ChatVisionOptions, } from "./chat-vision";
import { compactAgentTranscriptForApi } from "./agent-transcript-compact";
export function transcriptTurnToOpenAiMessages(turn: AgentTranscriptTurn): ChatCompletionMessageParam[] {
    const out: ChatCompletionMessageParam[] = [];
    if (turn.toolCalls?.length) {
        out.push({
            role: "assistant",
            content: turn.text?.trim() ? turn.text : null,
            tool_calls: turn.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: {
                    name: call.name,
                    arguments: call.arguments,
                },
            })),
        });
        for (const result of turn.toolResults ?? []) {
            out.push({
                role: "tool",
                tool_call_id: result.toolCallId,
                content: result.text,
            });
        }
        return out;
    }
    if (turn.text?.trim()) {
        out.push({ role: "assistant", content: turn.text });
    }
    return out;
}
export function chatHistoryToAgentOpenAiMessages(history: ChatMessage[], options?: ChatVisionOptions & {
    provider?: UserAiProviderId;
}): ChatCompletionMessageParam[] {
    const hasTranscript = history.some((message) => message.role === "assistant" && (message.agentTranscript?.length ?? 0) > 0);
    if (!hasTranscript) {
        return chatHistoryToOpenAiMessages(history, options);
    }
    const out: ChatCompletionMessageParam[] = [];
    for (const message of history) {
        if (message.role === "user") {
            out.push(...chatHistoryToOpenAiMessages([message], options).filter((item) => item.role === "user"));
            continue;
        }
        if (message.role !== "assistant")
            continue;
        const transcript = message.agentTranscript;
        if (transcript?.length) {
            for (const turn of compactAgentTranscriptForApi(transcript, {
                provider: options?.provider,
            })) {
                out.push(...transcriptTurnToOpenAiMessages(turn));
            }
            continue;
        }
        if (message.content.trim()) {
            out.push({ role: "assistant", content: message.content });
        }
    }
    return out;
}
