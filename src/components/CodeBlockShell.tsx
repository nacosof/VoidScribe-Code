import { useCallback, useState } from "react";
import type { UiLanguage } from "@/types";
import { t } from "@/lib/i18n";
type CodeBlockShellProps = {
    code: string;
    lang?: string;
    uiLang?: UiLanguage;
    compact?: boolean;
};
function CopyIcon() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>);
}
function CheckIcon() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5"/>
    </svg>);
}
export function CodeBlockShell({ code, uiLang = "ru", compact = false, }: CodeBlockShellProps) {
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        }
        catch {
        }
    }, [code]);
    return (<div className={`code-block-shell${compact ? " code-block-shell--compact" : ""}`}>
      <div className="code-block__body">
        <button type="button" className="code-block__copy" onClick={() => void handleCopy()} aria-label={copied ? t(uiLang, "copied") : t(uiLang, "copy")} title={copied ? t(uiLang, "copied") : t(uiLang, "copy")}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
        <pre className="code-block">
          <code>{code}</code>
        </pre>
      </div>
    </div>);
}
