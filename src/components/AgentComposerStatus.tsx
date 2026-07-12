import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";
export function AgentComposerStatus({ busy, lang }: {
    busy: boolean;
    lang?: UiLanguage;
}) {
    if (!busy)
        return null;
    return (<div className="agent-composer-status" aria-live="polite">
      <span className="agent-composer-status__spinner" aria-hidden/>
      <span className="agent-composer-status__label">{t(lang, "agentWorking")}</span>
    </div>);
}
