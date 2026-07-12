import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ChatMessage, UiLanguage } from "@/types";
import { MessageContent } from "@/lib/message-content";
import { AssistantMessageBody } from "@/components/AssistantMessageBody";
import { ChatContextChips } from "./ComposerContextChips";
import { t } from "@/lib/i18n";
type Props = {
    messages: ChatMessage[];
    sessionId?: string;
    streamingId?: string | null;
    chatActive?: boolean;
    lang: UiLanguage;
    onRestoreCheckpoint?: (checkpointId: string) => void;
};
const STICKY_BOTTOM_THRESHOLD_PX = 120;
function scrollToBottom(el: HTMLElement, behavior: ScrollBehavior = "auto") {
    el.scrollTo({ top: el.scrollHeight, behavior });
}
export function MessageList({ messages, sessionId, streamingId, chatActive = true, lang, onRestoreCheckpoint, }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickToBottomRef = useRef(true);
    const scrollKey = useMemo(() => {
        const last = messages[messages.length - 1];
        if (!last)
            return "0";
        const activityCount = last.agentActivities?.length ?? 0;
        const lastActivity = last.agentActivities?.[activityCount - 1];
        const activityTail = lastActivity?.type === "console_output"
            ? lastActivity.text?.length ?? 0
            : activityCount;
        return `${messages.length}:${last.id}:${last.content.length}:${activityTail}`;
    }, [messages]);
    const jumpToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
        const el = scrollRef.current;
        if (!el)
            return;
        scrollToBottom(el, behavior);
        stickToBottomRef.current = true;
    }, []);
    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickToBottomRef.current = distanceFromBottom <= STICKY_BOTTOM_THRESHOLD_PX;
    }, []);
    useLayoutEffect(() => {
        if (!chatActive || !messages.length)
            return;
        jumpToBottom("auto");
    }, [sessionId, chatActive, messages.length, jumpToBottom]);
    useEffect(() => {
        if (!chatActive || !messages.length)
            return;
        const el = scrollRef.current;
        if (!el)
            return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const shouldFollow = stickToBottomRef.current ||
            distanceFromBottom <= STICKY_BOTTOM_THRESHOLD_PX ||
            Boolean(streamingId);
        if (shouldFollow) {
            jumpToBottom(streamingId ? "smooth" : "auto");
        }
    }, [scrollKey, chatActive, streamingId, jumpToBottom]);
    if (!messages.length) {
        return (<div ref={scrollRef} className="messages overlay-scrollbar">
        <div className="empty-state">
          <h2>{t(lang, "appName")}</h2>
          <p>{t(lang, "emptyChatHint")}</p>
        </div>
      </div>);
    }
    return (<div ref={scrollRef} className="messages overlay-scrollbar" onScroll={handleScroll}>
      <div className="chat-thread">
        {messages.map((message) => (<article key={message.id} className="chat-turn">
            {message.role === "user" ? (<div className="chat-turn__prompt">
                {message.contextRefs?.length ? (<ChatContextChips refs={message.contextRefs} lang={lang}/>) : null}
                {message.content ? (<MessageContent content={message.content} lang={lang}/>) : null}
                {message.images?.length ? (<div className="chat-turn__images">
                    {message.images.map((image) => (<img key={image.id} className="chat-turn__image" src={image.dataUrl} alt={image.name}/>))}
                  </div>) : null}
              </div>) : (<AssistantMessageBody message={message} isStreaming={message.id === streamingId} lang={lang} onRestoreCheckpoint={onRestoreCheckpoint}/>)}
          </article>))}
      </div>
    </div>);
}
