import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatMessage } from "../../src/types";
import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
import type { UserAiProviderId } from "../../src/lib/providers";
import { type ChatVisionOptions } from "./chat-vision";
export declare function transcriptTurnToOpenAiMessages(turn: AgentTranscriptTurn): ChatCompletionMessageParam[];
export declare function chatHistoryToAgentOpenAiMessages(history: ChatMessage[], options?: ChatVisionOptions & {
    provider?: UserAiProviderId;
}): ChatCompletionMessageParam[];
