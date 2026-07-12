export type ParsedCodeError = {
    file: string;
    line?: number;
    message: string;
    kind: "css" | "typescript" | "other";
};
export declare function parseCodeErrorsFromOutput(text: string): ParsedCodeError[];
export declare function stripAgentPastedLineNumbers(text: string): string;
export declare function formatFileContentForAgent(path: string, content: string): string;
export declare function userIntentMentionsCodeError(userIntent: string): boolean;
export declare function parseCodeErrorsFromUserIntent(userIntent: string): ParsedCodeError[];
export declare function isProductionBuildCommand(command: string): boolean;
export declare function analyzeCommandOutput(input: {
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    userIntent?: string;
}): {
    success: boolean;
    errors: ParsedCodeError[];
    agentNote: string;
};
