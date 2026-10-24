/** Default tool-call budget when preset leaves maxAgentSteps empty. */
export const DEFAULT_MAX_AGENT_STEPS = 50;

export function resolveAgentStepLimit(maxAgentSteps?: number): number | null {
    if (typeof maxAgentSteps !== "number" || !Number.isFinite(maxAgentSteps)) {
        return DEFAULT_MAX_AGENT_STEPS;
    }
    const rounded = Math.floor(maxAgentSteps);
    return rounded > 0 ? rounded : DEFAULT_MAX_AGENT_STEPS;
}
export function normalizeMaxAgentSteps(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value))
        return undefined;
    const rounded = Math.floor(value);
    return rounded > 0 ? rounded : undefined;
}
