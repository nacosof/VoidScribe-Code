import type { UserAiProviderId } from "./providers";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export type AppSettings = {
  provider: UserAiProviderId;
  apiKey: string;
  model: string;
  workspacePath: string;
  systemPrompt: string;
};

export type SettingsPublic = Omit<AppSettings, "apiKey"> & {
  hasApiKey: boolean;
  apiKeyHint: string;
};

export type StreamChunk = {
  requestId: string;
  delta: string;
  done?: boolean;
  error?: string;
};

export interface VoidScribeApi {
  getSettings: () => Promise<SettingsPublic>;
  saveSettings: (input: Partial<AppSettings>) => Promise<SettingsPublic>;
  selectWorkspace: () => Promise<string | null>;
  sendMessage: (
    messages: ChatMessage[],
    requestId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => () => void;
}

declare global {
  interface Window {
    voidscribe: VoidScribeApi;
  }
}

export {};
