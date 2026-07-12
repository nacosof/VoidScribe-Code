export type AgentToolEvent = {
    type: "tool_start";
    name: string;
    detail: string;
} | {
    type: "tool_done";
    name: string;
    detail: string;
    failed?: boolean;
    error?: string;
} | {
    type: "file_change";
    path: string;
    kind: "created" | "modified";
    previousContent: string | null;
    newContent: string;
    staged?: boolean;
} | {
    type: "console_command";
    command: string;
    source: "agent" | "user";
} | {
    type: "console_output";
    text: string;
    stream: "stdout" | "stderr" | "system";
} | {
    type: "model_progress";
    step: string;
    chars: number;
};
