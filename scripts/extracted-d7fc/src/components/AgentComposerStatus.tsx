import {
  formatAgentElapsed,
  resolveStreamingIndicator,
} from "@/lib/agent-activity-ui";
import { useElapsedSince } from "@/hooks/useElapsedSince";
import type { AgentActivity, UiLanguage } from "@/types";

type AgentComposerStatusProps = {
  activities: AgentActivity[];
  isStreaming: boolean;
  lang: UiLanguage;
};

export function AgentComposerStatus({
  activities,
  isStreaming,
  lang,
}: AgentComposerStatusProps) {
  const indicator = resolveStreamingIndicator(activities, isStreaming, lang);
  const elapsed = useElapsedSince(
    Boolean(indicator),
    indicator?.elapsedKey ?? "idle"
  );

  if (!indicator) return null;

  return (
    <div className="agent-composer-status" aria-live="polite">
      <span className="agent-composer-status__spinner" aria-hidden />
      <span className="agent-composer-status__label">{indicator.label}</span>
      <span className="agent-composer-status__elapsed">
        {formatAgentElapsed(elapsed, lang)}
      </span>
    </div>
  );
}
