export function estimateContextUsage(chars: number, budget = 120000): number { return Math.min(1, Math.max(0, chars / budget)); }
export function formatContextUsage(value: number): string { return `${Math.round(value * 100)}%`; }
