import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { MessageContent } from "@/lib/message-content";
import { buildAssistantSegments } from "@/lib/assistant-segments";
import type { ChatMessage, UiLanguage } from "@/types";
type AssistantMessageBodyProps = {
    message: ChatMessage;
    isStreaming: boolean;
    lang: UiLanguage;
    onRestoreCheckpoint?: (checkpointId: string) => void;
};
export function AssistantMessageBody({ message, isStreaming, lang, onRestoreCheckpoint, }: AssistantMessageBodyProps) {
    const segments = buildAssistantSegments(message);
    const lastActivitySegmentIndex = segments.reduce((last, segment, index) => (segment.kind === "activities" ? index : last), -1);
    if (segments.length === 0) {
        if (isStreaming) {
            return (<AgentActivityFeed activities={message.agentActivities ?? []} isLive showLiveThought lang={lang} onRestoreCheckpoint={onRestoreCheckpoint}/>);
        }
        return null;
    }
    return (<div className="chat-turn__response">
      {segments.map((segment, index) => {
            if (segment.kind === "text") {
                return (<MessageContent key={`text-${index}`} content={segment.content} lang={lang}/>);
            }
            const isLastActivitySegment = index === lastActivitySegmentIndex;
            return (<AgentActivityFeed key={`act-${index}`} activities={segment.activities} isLive={isStreaming && isLastActivitySegment} showLiveThought={isStreaming && isLastActivitySegment} showSummary={!isStreaming && isLastActivitySegment} lang={lang} onRestoreCheckpoint={onRestoreCheckpoint}/>);
        })}
    </div>);
}
