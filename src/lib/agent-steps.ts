export function resolveAgentStepLimit(maxAgentSteps?: number): number | null {
    if (typeof maxAgentSteps !== "number" || !Number.isFinite(maxAgentSteps)) {
        return null;
    }
    const rounded = Math.floor(maxAgentSteps);
    return rounded > 0 ? rounded : null;
}
export function normalizeMaxAgentSteps(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value))
        return undefined;
    const rounded = Math.floor(value);
    return rounded > 0 ? rounded : undefined;
}
