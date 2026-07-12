import type { AgentTranscriptTurn } from "@/lib/agent-transcript";
import type { AgentActivity, ChatMessage } from "@/types";
export type AssistantRenderSegment = {
    kind: "text";
    content: string;
} | {
    kind: "activities";
    activities: AgentActivity[];
};
function isModelActivity(activity: AgentActivity): boolean {
    return ((activity.type === "tool_start" || activity.type === "tool_done") &&
        activity.name === "model");
}
function sliceActivitiesForToolTurn(activities: AgentActivity[], fromIndex: number, toolCallCount: number): {
    slice: AgentActivity[];
    nextIndex: number;
} {
    const slice: AgentActivity[] = [];
    let index = fromIndex;
    let completedTools = 0;
    while (index < activities.length && completedTools < toolCallCount) {
        const activity = activities[index]!;
        if (isModelActivity(activity)) {
            index += 1;
            continue;
        }
        slice.push(activity);
        if (activity.type === "tool_done" && activity.name && activity.name !== "model") {
            completedTools += 1;
        }
        index += 1;
    }
    return { slice, nextIndex: index };
}
function sliceRemainingActivities(activities: AgentActivity[], fromIndex: number): AgentActivity[] {
    const slice: AgentActivity[] = [];
    for (let index = fromIndex; index < activities.length; index += 1) {
        const activity = activities[index]!;
        if (!isModelActivity(activity))
            slice.push(activity);
    }
    return slice;
}
function extractTrailingContent(content: string, transcript: AgentTranscriptTurn[]): string {
    let offset = 0;
    for (const turn of transcript) {
        const text = turn.text?.trim();
        if (!text)
            continue;
        const index = content.indexOf(text, offset);
        if (index >= 0)
            offset = index + text.length;
    }
    return content.slice(offset).trimStart();
}
function buildFromTranscript(transcript: AgentTranscriptTurn[], activities: AgentActivity[], content: string): AssistantRenderSegment[] {
    const segments: AssistantRenderSegment[] = [];
    let activityIndex = 0;
    for (const turn of transcript) {
        if (turn.text?.trim()) {
            segments.push({ kind: "text", content: turn.text.trim() });
        }
        const toolCount = turn.toolCalls?.length ?? 0;
        if (toolCount > 0) {
            const { slice, nextIndex } = sliceActivitiesForToolTurn(activities, activityIndex, toolCount);
            activityIndex = nextIndex;
            if (slice.length > 0) {
                segments.push({ kind: "activities", activities: slice });
            }
        }
    }
    const tailActivities = sliceRemainingActivities(activities, activityIndex);
    const tailText = extractTrailingContent(content, transcript);
    if (tailActivities.length > 0) {
        segments.push({ kind: "activities", activities: tailActivities });
    }
    if (tailText.trim()) {
        segments.push({ kind: "text", content: tailText.trim() });
    }
    else if (content.trim() && !segments.some((segment) => segment.kind === "text")) {
        segments.push({ kind: "text", content: content.trim() });
    }
    return segments;
}
function buildFromSplitFallback(message: ChatMessage): AssistantRenderSegment[] {
    const activities = message.agentActivities ?? [];
    const content = message.content;
    const split = message.contentSplitIndex;
    const activitySplit = message.activitySplitIndex ?? 0;
    if (!activities.length && !content.trim())
        return [];
    if (split === undefined) {
        if (!activities.length)
            return [{ kind: "text", content: content.trim() }];
        if (!content.trim())
            return [{ kind: "activities", activities }];
        return [
            { kind: "text", content: content.trim() },
            { kind: "activities", activities },
        ];
    }
    const segments: AssistantRenderSegment[] = [];
    const beforeActivities = activities.slice(0, activitySplit);
    const afterActivities = activities.slice(activitySplit);
    const contentBefore = content.slice(0, split).trim();
    const contentAfter = content.slice(split).trim();
    if (beforeActivities.length > 0) {
        segments.push({ kind: "activities", activities: beforeActivities });
    }
    if (contentBefore)
        segments.push({ kind: "text", content: contentBefore });
    if (afterActivities.length > 0) {
        segments.push({ kind: "activities", activities: afterActivities });
    }
    if (contentAfter)
        segments.push({ kind: "text", content: contentAfter });
    return segments;
}
export function buildAssistantSegments(message: ChatMessage): AssistantRenderSegment[] {
    const transcript = message.agentTranscript ?? [];
    const activities = message.agentActivities ?? [];
    const content = message.content;
    if (transcript.length > 0) {
        return buildFromTranscript(transcript, activities, content);
    }
    return buildFromSplitFallback(message);
}
export function isActionableAgentEvent(event: AgentActivity): boolean {
    if (event.type === "file_change" || event.type === "console_command")
        return true;
    if (event.type === "tool_start" && event.name && event.name !== "model")
        return true;
    return false;
}
