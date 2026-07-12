import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { ChatContextChips } from "@/components/ComposerContextChips";
import { MessageContent } from "@/lib/message-content";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";
import type { ChatMessage } from "@/types";

type MessageListProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  lang: UiLanguage;
};

type ChatTurn = {
  user?: ChatMessage;
  assistant?: ChatMessage;
};

function groupTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];

    if (message.role === "user") {
      const next = messages[index + 1];
      const assistant = next?.role === "assistant" ? next : undefined;
      turns.push({ user: message, assistant });
      index += assistant ? 2 : 1;
      continue;
    }

    turns.push({ assistant: message });
    index += 1;
  }

  return turns;
}

function AssistantBody({
  message,
  isStreaming,
  lang,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  lang: UiLanguage;
}) {
  const activities = message.activities ?? [];
  const splitIndex = message.activitySplitIndex ?? activities.length;
  const beforeActivities = activities.slice(0, splitIndex);
  const afterActivities = activities.slice(splitIndex);

  const content = message.content;
  const contentSplit = message.contentSplitIndex;
  const contentBefore =
    contentSplit !== undefined ? content.slice(0, contentSplit) : content;
  const contentAfter =
    contentSplit !== undefined ? content.slice(contentSplit) : "";

  const hasContentBefore = Boolean(contentBefore.trim());
  const hasContentAfter = Boolean(contentAfter.trim());
  const hasAnyContent = hasContentBefore || hasContentAfter;

  const showTyping = isStreaming && !hasAnyContent && activities.length === 0;
  const isLiveTop = isStreaming && !hasAnyContent;
  const isLiveBottom = isStreaming && hasAnyContent;

  return (
    <div className="chat-turn__response">
      {beforeActivities.length > 0 || isLiveTop ? (
        <AgentActivityFeed
          activities={beforeActivities}
          isLive={isLiveTop}
          showSummary={!hasAnyContent}
          lang={lang}
        />
      ) : null}

      {showTyping ? (
        <span className="typing" aria-label={t(lang, "assistantTyping")}>
          <span />
          <span />
          <span />
        </span>
      ) : null}

      {hasContentBefore ? (
        <MessageContent content={contentBefore} lang={lang} />
      ) : null}

      {afterActivities.length > 0 || isLiveBottom ? (
        <AgentActivityFeed
          activities={afterActivities}
          isLive={isLiveBottom}
          showSummary
          lang={lang}
        />
      ) : null}

      {hasContentAfter ? (
        <MessageContent content={contentAfter} lang={lang} />
      ) : null}
    </div>
  );
}

export function MessageList({ messages, isStreaming, lang }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="chat-thread">
        <div className="empty-state">
          <h2>{t(lang, "chatEmptyTitle")}</h2>
          <p>{t(lang, "chatEmptyHint")}</p>
        </div>
      </div>
    );
  }

  const turns = groupTurns(messages);
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  return (
    <div className="chat-thread">
      {turns.map((turn, index) => (
        <article
          key={turn.assistant?.id ?? turn.user?.id ?? index}
          className="chat-turn"
        >
          {turn.user ? (
            <div className="chat-turn__prompt">
              {turn.user.contextRefs?.length ? (
                <ChatContextChips refs={turn.user.contextRefs} lang={lang} />
              ) : null}
              {turn.user.content.trim() ? (
                <MessageContent content={turn.user.content} lang={lang} />
              ) : null}
              {turn.user.images?.length ? (
                <div className="chat-turn__images">
                  {turn.user.images.map((image, index) => (
                    <img
                      key={`${image.name ?? "image"}-${index}`}
                      className="chat-turn__image"
                      src={`data:${image.mediaType};base64,${image.base64}`}
                      alt={image.name ?? ""}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {turn.assistant ? (
            <AssistantBody
              message={turn.assistant}
              isStreaming={
                isStreaming && turn.assistant.id === lastAssistantId
              }
              lang={lang}
            />
          ) : null}
        </article>
      ))}
    </div>
  );
}
