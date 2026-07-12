import type { AgentEditorContext, ChatMessage } from "../../src/types";
import type { ChatInteractionMode } from "../../src/lib/chat-modes";
import type { AgentTranscriptTurn } from "../../src/lib/agent-transcript";
import { type PersistedSettings } from "./store";
import type { AgentToolEvent } from "./agent-tools";
export declare function streamAgentChat(input: {
    messages: ChatMessage[];
    workspaceRoot: string;
    mode?: ChatInteractionMode;
    editorContext?: AgentEditorContext;
    settings?: PersistedSettings;
    signal?: AbortSignal;
    onTextDelta: (delta: string) => void;
    onEvent: (event: AgentToolEvent) => void;
    onTranscript?: (turns: AgentTranscriptTurn[]) => void;
}): Promise<void>;
