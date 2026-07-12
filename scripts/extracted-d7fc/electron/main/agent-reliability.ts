import OpenAI from "openai";

export class AgentLoopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentLoopError";
  }
}

export class AgentStepBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentStepBudgetError";
  }
}

export function isRateLimitError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    return err.status === 429;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|rate limit|too many requests/i.test(msg);
}

export function isToolCallGenerationError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError && err.status === 400) {
    const body = err.error as { code?: string } | undefined;
    if (body?.code === "tool_use_failed") return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /tool_use_failed|Failed to call a function/i.test(msg);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Сколько ждать перед повтором после 429 */
export function rateLimitBackoffMs(attempt: number): number {
  return Math.min(15_000, 2_500 * (attempt + 1));
}

export class AgentToolLoopGuard {
  private readonly repeats = new Map<string, number>();

  recordToolCall(name: string, detail: string): void {
    const key = `${name}\0${detail.trim()}`;
    const next = (this.repeats.get(key) ?? 0) + 1;
    this.repeats.set(key, next);

    const limit =
      name === "list_directory" || name === "read_file" ? 6 : 3;

    if (next >= limit) {
      throw new AgentLoopError(
        `Агент ${next} раз подряд вызвал «${name}»${detail ? ` (${detail})` : ""}. ` +
          `Остановлено, чтобы не тратить лимит API и время. ` +
          `Уточни задачу, смени модель или начни новый чат.`
      );
    }
  }
}
