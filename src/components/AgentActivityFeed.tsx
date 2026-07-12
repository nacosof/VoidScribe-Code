import { buildAgentSteps, formatAgentActivitySummary, formatAgentElapsed, getLiveThoughtStep, isCommandStep, resolveStreamingIndicator, } from "@/lib/agent-activity-ui";
import { useElapsedSince } from "@/hooks/useElapsedSince";
import { CodeBlockShell } from "@/components/CodeBlockShell";
import { t } from "@/lib/i18n";
import type { AgentActivity, UiLanguage } from "@/types";
type AgentActivityFeedProps = {
    activities: AgentActivity[];
    liveActivities?: AgentActivity[];
    isLive?: boolean;
    showSummary?: boolean;
    hideRunningModel?: boolean;
    showLiveThought?: boolean;
    lang: UiLanguage;
    onRestoreCheckpoint?: (checkpointId: string) => void;
};
function ThoughtRow({ elapsed, lang, }: {
    elapsed: number;
    lang: UiLanguage;
}) {
    return (<div className="agent-activity__step agent-activity__step--running agent-activity__step--thought">
      <span className="agent-activity__icon" aria-hidden>
        <span className="agent-activity__spinner"/>
      </span>
      <span className="agent-activity__label">
        {t(lang, "agentThoughtDuration", formatAgentElapsed(elapsed))}
      </span>
    </div>);
}
export function AgentActivityFeed({ activities, liveActivities, isLive = false, showSummary = false, hideRunningModel = false, showLiveThought = true, lang, onRestoreCheckpoint, }: AgentActivityFeedProps) {
    const stepSource = isLive ? (liveActivities ?? activities) : activities;
    const steps = buildAgentSteps(stepSource, {
        finalize: !isLive,
        lang,
        hideRunningModel,
    });
    const summary = showSummary ? formatAgentActivitySummary(stepSource, lang) : null;
    const liveThought = isLive ? getLiveThoughtStep(steps) : null;
    const indicatorSource = liveActivities ?? activities;
    const waitingIndicator = resolveStreamingIndicator(indicatorSource, isLive, lang);
    const showWaitingRow = isLive &&
        !liveThought &&
        !steps.some((step) => step.status === "running" && step.kind !== "model") &&
        Boolean(waitingIndicator);
    const showPrepRow = isLive && stepSource.length === 0;
    const elapsedKey = liveThought?.id ?? waitingIndicator?.elapsedKey ?? "idle";
    const elapsed = useElapsedSince(isLive && (Boolean(liveThought) || showWaitingRow || showPrepRow), elapsedKey);
    const runningCommandStep = steps.find((step) => step.kind === "command" && step.status === "running");
    const visibleSteps = steps.filter((step) => {
        if (step.kind === "model")
            return false;
        if (isLive && step.kind === "output" && step.detail !== "stderr" && step.detail !== "stdout")
            return false;
        if (isLive && step.kind === "output" && step.detail === "stdout" && !runningCommandStep)
            return false;
        if (isLive && step.status === "done" && step.kind !== "file")
            return false;
        return true;
    });
    const commandElapsed = useElapsedSince(isLive && Boolean(runningCommandStep), runningCommandStep?.id ?? "cmd");
    const showThoughtRow = showLiveThought &&
        (Boolean(liveThought) || showWaitingRow || showPrepRow);
    if (visibleSteps.length === 0 && !summary && !showThoughtRow) {
        return null;
    }
    return (<div className="agent-activity" aria-live={isLive ? "polite" : "off"}>
      {summary ? <div className="agent-activity__summary">{summary}</div> : null}

      {showThoughtRow ? <ThoughtRow elapsed={elapsed} lang={lang}/> : null}

      {visibleSteps.length > 0 ? (<div className="agent-activity__steps">
          {visibleSteps.map((step, index) => {
                const commandText = isCommandStep(step) ? step.label : null;
                return (<div key={`${step.id}:${index}`} className={`agent-activity__step agent-activity__step--${step.status}${step.detail === "stderr" ? " agent-activity__step--stderr" : ""}${step.detail === "stdout" ? " agent-activity__step--stdout" : ""}${commandText ? " agent-activity__step--command" : ""}`}>
                {step.status === "running" ? (<span className="agent-activity__icon" aria-hidden>
                    <span className="agent-activity__spinner"/>
                  </span>) : null}

                {commandText ? (<div className="agent-activity__command">
                    <CodeBlockShell code={commandText} lang="sh" uiLang={lang} compact/>
                    {step.status === "running" && isLive && step.id === runningCommandStep?.id ? (<span className="agent-activity__command-meta">
                        {t(lang, "agentCommandRunning", formatAgentElapsed(commandElapsed))}
                        {commandElapsed >= 45000 ? (<span className="agent-activity__command-hint"> {t(lang, "agentCommandSlow")}</span>) : null}
                      </span>) : null}
                    {step.status === "error" && step.error ? (<span className="agent-activity__error">{step.error.replace(/\x1b\[[0-9;]*m/g, "")}</span>) : null}
                  </div>) : (<span className="agent-activity__label">
                    {step.label}
                    {step.status === "error" && step.error ? (<span className="agent-activity__error"> — {step.error.replace(/\x1b\[[0-9;]*m/g, "")}</span>) : null}
                    {step.kind === "file" && step.checkpointId && onRestoreCheckpoint ? (<button type="button" className="agent-activity__checkpoint-btn" onClick={() => onRestoreCheckpoint(step.checkpointId!)} title={t(lang, "restoreCheckpoint")}>
                        {t(lang, "restoreCheckpoint")}
                      </button>) : null}
                  </span>)}
              </div>);
            })}
        </div>) : null}
    </div>);
}
