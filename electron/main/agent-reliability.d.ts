export declare const AGENT_TRUNCATION_USER_NOTE = "\u041E\u0442\u0432\u0435\u0442 \u043C\u043E\u0434\u0435\u043B\u0438 \u0431\u044B\u043B \u043E\u0431\u0440\u0435\u0437\u0430\u043D. \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0439 \u0441 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u0443\u0441\u043F\u0435\u0448\u043D\u043E\u0433\u043E \u0448\u0430\u0433\u0430.";
export declare const AGENT_CHAT_RETRIES = 2;
export declare const AGENT_CHAT_RETRY_DELAY_MS = 1200;
export declare function sleep(ms: number): Promise<void>;
export declare function createAssistantTextStreamer(onTextDelta: (delta: string) => void): {
    push(text: string): void;
    reset(): void;
};
export declare function getLastUserMessageText(messages: Array<{
    role?: string;
    content?: unknown;
}>): string;
export declare function isRateLimitError(err: unknown): boolean;
export declare function rateLimitBackoffMs(attempt: number): number;
export declare function isToolCallGenerationError(err: unknown): boolean;
export declare function buildTruncationNudge(path?: string | null): string;
