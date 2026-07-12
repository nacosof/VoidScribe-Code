export type AgentEditorContext = {
    activePath?: string | null;
    openPaths?: string[];
};
export type AgentPromptOptions = {
    projectMature?: boolean;
    editorContext?: AgentEditorContext;
    osPlatform?: string;
};
export declare function formatAgentSystemInfo(input: {
    workspacePath: string;
    editorContext?: AgentEditorContext;
    osPlatform?: string;
}): string;
export declare const LOCAL_INLINE_TOOL_RULES: string;
export declare function buildAgentSystemPrompt(workspacePath: string, useInlineToolFormat?: boolean, workspaceSnapshot?: string, options?: AgentPromptOptions): string;
