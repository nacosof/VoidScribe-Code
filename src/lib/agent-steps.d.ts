/** Default tool-call budget when preset leaves maxAgentSteps empty. */
export declare const DEFAULT_MAX_AGENT_STEPS = 50;
export declare function resolveAgentStepLimit(maxAgentSteps?: number): number | null;
export declare function normalizeMaxAgentSteps(value: unknown): number | undefined;
