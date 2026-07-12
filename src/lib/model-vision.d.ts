import type { UserAiProviderId } from "./providers";
export declare function modelSupportsVision(provider: UserAiProviderId, model: string): boolean;
export declare function visionModelHint(provider: UserAiProviderId): string;
export declare function buildVisionUnsupportedNote(imageCount: number, provider: UserAiProviderId): string;
