const activeRequests = new Map<string, AbortController>();

export function beginChatRequest(requestId: string): AbortSignal {
  cancelChatRequest(requestId);
  const controller = new AbortController();
  activeRequests.set(requestId, controller);
  return controller.signal;
}

export function cancelChatRequest(requestId: string): boolean {
  const controller = activeRequests.get(requestId);
  if (!controller) return false;
  controller.abort();
  activeRequests.delete(requestId);
  return true;
}

export function endChatRequest(requestId: string): void {
  activeRequests.delete(requestId);
}

export function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "AbortError" || /aborted/i.test(err.message);
}
