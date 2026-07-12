import { useEffect, useId, useRef, useState } from "react";
import {
  CONTEXT_SEGMENT_COLORS,
  formatTokenCount,
  type ContextUsageReport,
  type ContextUsageSegmentId,
} from "@/lib/context-usage";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

type ContextUsageIndicatorProps = {
  usage: ContextUsageReport;
  lang: UiLanguage;
};

const SEGMENT_LABEL_KEYS: Record<ContextUsageSegmentId, string> = {
  system: "contextSegmentSystem",
  rules: "contextSegmentRules",
  tools: "contextSegmentTools",
  workspace: "contextSegmentWorkspace",
  conversation: "contextSegmentConversation",
  draft: "contextSegmentDraft",
  refs: "contextSegmentRefs",
};

function ringTone(percent: number): "normal" | "warn" | "danger" {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warn";
  return "normal";
}

export function ContextUsageIndicator({
  usage,
  lang,
}: ContextUsageIndicatorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const {
    percent,
    fullPercent,
    totalTokens,
    limitTokens,
    segments,
    limitIsConfigurable,
    fixedTokens,
  } = usage;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(percent, 100) / 100) * circumference;
  const tone = ringTone(percent);

  return (
    <div className="context-usage" ref={rootRef}>
      <button
        type="button"
        className={`context-usage__trigger context-usage__trigger--${tone}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${t(lang, "contextUsageTitle")}: ${Math.round(percent)}%`}
        title={`${t(lang, "contextUsageTitle")}: ${Math.round(percent)}%`}
      >
        <svg
          className="context-usage__ring"
          width="28"
          height="28"
          viewBox="0 0 28 28"
          aria-hidden
        >
          <circle
            className="context-usage__ring-track"
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            strokeWidth="2.5"
          />
          <circle
            className="context-usage__ring-progress"
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
            transform="rotate(-90 14 14)"
          />
        </svg>
      </button>

      {open ? (
        <div className="context-usage__panel" id={panelId} role="dialog">
          <header className="context-usage__head">
            <div>
              <p className="context-usage__title">{t(lang, "contextUsageTitle")}</p>
              <p className="context-usage__summary">
                {t(lang, "contextUsageChatLine", Math.round(percent))} ·{" "}
                {t(lang, "contextUsageTotalLine", Math.round(fullPercent))}
              </p>
              <p className="context-usage__tokens">
                ~{formatTokenCount(totalTokens)} / {formatTokenCount(limitTokens)}
                {fixedTokens > 0
                  ? ` · ${t(lang, "contextUsageAgentBase", formatTokenCount(fixedTokens))}`
                  : null}
              </p>
            </div>
            <button
              type="button"
              className="context-usage__close"
              onClick={() => setOpen(false)}
              aria-label={t(lang, "close")}
            >
              ×
            </button>
          </header>

          <div className="context-usage__bar" aria-hidden>
            {segments.map((segment) => {
              const width = totalTokens
                ? (segment.tokens / totalTokens) * 100
                : 0;
              return (
                <span
                  key={segment.id}
                  className="context-usage__bar-segment"
                  style={{
                    width: `${width}%`,
                    background: CONTEXT_SEGMENT_COLORS[segment.id],
                  }}
                />
              );
            })}
          </div>

          <ul className="context-usage__list">
            {segments.map((segment) => (
              <li key={segment.id} className="context-usage__item">
                <span
                  className="context-usage__dot"
                  style={{ background: CONTEXT_SEGMENT_COLORS[segment.id] }}
                />
                <span className="context-usage__item-label">
                  {t(lang, SEGMENT_LABEL_KEYS[segment.id])}
                  {segment.approximate ? (
                    <span className="context-usage__approx">
                      {" "}
                      {t(lang, "contextUsageApprox")}
                    </span>
                  ) : null}
                </span>
                <span className="context-usage__item-value">
                  {formatTokenCount(segment.tokens)}
                </span>
              </li>
            ))}
          </ul>

          {limitIsConfigurable ? (
            <p className="context-usage__note">{t(lang, "contextUsageLocalNote")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
