import type { AgentEditorContext } from "../../src/types";
import type { ChatInteractionMode } from "../../src/lib/chat-modes";
import { buildAgentSystemPrompt as buildAgentPromptFromRules } from "../../src/lib/agent-prompt";
import { snapshotWorkspaceTextFiles } from "./workspace";
import { hasMatureProjectAt } from "./project-scaffold";
export async function buildAgentSystemPrompt(input: {
    mode: ChatInteractionMode;
    workspaceRoot: string;
    useInlineToolFormat: boolean;
    editorContext?: AgentEditorContext;
}): Promise<string> {
    const overview = input.workspaceRoot.trim()
        ? await snapshotWorkspaceTextFiles(input.workspaceRoot, 80)
        : "(no folder open)";
    const projectMature = input.mode === "agent" && input.workspaceRoot.trim()
        ? await hasMatureProjectAt(input.workspaceRoot, ".")
        : false;
    return buildAgentPromptFromRules(input.workspaceRoot, input.useInlineToolFormat, overview, {
        projectMature,
        editorContext: input.editorContext,
        osPlatform: process.platform,
    });
}
