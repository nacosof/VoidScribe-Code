export declare function beginChatRequest(requestId: string): AbortSignal;
export declare function cancelChatRequest(requestId: string): boolean;
export declare function cancelAllChatRequests(): string[];
export declare function cancelChatRequestWithCommands(requestId: string): boolean;
export declare function interruptAgentWork(): string[];
export declare function endChatRequest(requestId: string): void;
export declare function isAbortError(err: unknown): boolean;
