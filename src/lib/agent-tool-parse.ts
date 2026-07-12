export function extractToolNames(text: string): string[] { return [...text.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((m) => m[1]!); }
