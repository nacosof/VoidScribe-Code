import {
  buildAgentSteps,
  formatAgentActivitySummary,
  formatAgentElapsed,
  getRunningAgentStep,
  resolveStreamingIndicator,
} from "@/lib/agent-activity-ui";
import { useElapsedSince } from "@/hooks/useElapsedSince";
import { t } from "@/lib/i18n";
import type { AgentActivity, UiLanguage } from "@/types";

type AgentActivityFeedProps = {
  activities: AgentActivity[];
  liveActivities?: AgentActivity[];
  isLive?: boolean;
  showSummary?: boolean;
  hideRunningModel?: boolean;
  lang: UiLanguage;
};

export function AgentActivityFeed({
  activities,
  liveActivities,
  isLive = false,
  showSummary = true,
  hideRunningModel = false,
  lang,
}: AgentActivityFeedProps) {
  const stepSource = isLive ? (liveActivities ?? activities) : activities;
  const steps = buildAgentSteps(stepSource, {
    finalize: !isLive,
    lang,
    hideRunningModel,
  });
  const summary = formatAgentActivitySummary(stepSource, lang);
  const runningStep = getRunningAgentStep(steps);
  const indicatorSource = liveActivities ?? activities;
  const waitingIndicator = resolveStreamingIndicator(
    indicatorSource,
    isLive,
    lang
  );
  const showWaitingRow = isLive && !runningStep && Boolean(waitingIndicator);
  const elapsedKey =
    runningStep?.id ?? waitingIndicator?.elapsedKey ?? "idle";
  const elapsed = useElapsedSince(
    isLive && (Boolean(runningStep) || showWaitingRow),
    elapsedKey
  );

  const visibleSteps = steps.filter(
    (step) => !(isLive && step.kind === "output" && step.detail !== "stderr")
  );

  const showLiveSummary =
    showSummary && isLive && visibleSteps.length === 0 && !showWaitingRow;

  if (
    visibleSteps.length === 0 &&
    !(showSummary && summary) &&
    !showWaitingRow &&
    !showLiveSummary
  ) {
    return null;
  }

  return (
    <div className="agent-activity" aria-live={isLive ? "polite" : "off"}>
      {showSummary && summary ? (
        <div className="agent-activity__summary">{summary}</div>
      ) : showLiveSummary ? (
        <div className="agent-activity__summary agent-activity__summary--live">
          {t(lang, "agentWorking")}
        </div>
      ) : null}

      {visibleSteps.length > 0 ? (
        <div className="agent-activity__steps">
          {visibleSteps.map((step) => (
            <div
              key={step.id}
              className={`agent-activity__step agent-activity__step--${step.status}${
                step.detail === "stderr" ? " agent-activity__step--stderr" : ""
              }${
                step.detail === "command" ||
                step.kind === "tool" ||
                step.kind === "file" ||
                step.kind === "model"
                  ? " agent-activity__step--mono"
                  : ""
              }`}
            >
              <span className="agent-activity__icon" aria-hidden>
                {step.status === "running" ? (
                  <span className="agent-activity__spinner" />
                ) : step.status === "done" ? (
                  "✓"
                ) : step.status === "error" ? (
                  "!"
                ) : (
                  "·"
                )}
              </span>
              <span className="agent-activity__label">
                {step.label}
                {isLive && step.status === "running" && step.id === elapsedKey ? (
                  <span className="agent-activity__elapsed">
                    {" "}
                    · {formatAgentElapsed(elapsed, lang)}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {showWaitingRow && waitingIndicator ? (
        <div className="agent-activity__step agent-activity__step--running agent-activity__step--waiting">
          <span className="agent-activity__icon" aria-hidden>
            <span className="agent-activity__spinner" />
          </span>
          <span className="agent-activity__label">
            {waitingIndicator.label}
            <span className="agent-activity__elapsed">
              {" "}
              · {formatAgentElapsed(elapsed, lang)}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
