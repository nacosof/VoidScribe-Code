import { Children, isValidElement, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/types";

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

function extractLanguage(node: React.ReactNode): string {
  const visit = (current: React.ReactNode): string => {
    if (isValidElement<{ className?: string; children?: React.ReactNode }>(
      current
    )) {
      const match = /language-([\w-]+)/.exec(current.props.className ?? "");
      if (match?.[1]) return match[1];
      return visit(current.props.children);
    }
    if (Array.isArray(current)) {
      for (const child of current) {
        const lang = visit(child);
        if (lang) return lang;
      }
    }
    return "";
  };
  return visit(node) || "text";
}

function createMarkdownComponents(uiLang: UiLanguage): Components {
  return {
    pre({ children }) {
      const codeText = extractText(children).replace(/\n$/, "");
      const language = extractLanguage(children);

      return (
        <div className="code-block-shell">
          <div className="code-block__head">
            <span className="code-block__lang">{language}</span>
            <button
              type="button"
              className="code-block__copy"
              onClick={() => void navigator.clipboard.writeText(codeText)}
            >
              {t(uiLang, "copy")}
            </button>
          </div>
          <pre className="code-block">{children}</pre>
        </div>
      );
    },
    code({ className, children, ...props }) {
      if (className?.includes("language-")) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }

      return (
        <code className="md-inline-code" {...props}>
          {children}
        </code>
      );
    },
    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          className="md-link"
          target="_blank"
          rel="noreferrer noopener"
          {...props}
        >
          {children}
        </a>
      );
    },
    table({ children }) {
      return (
        <div className="md-table-wrap">
          <table className="md-table">{children}</table>
        </div>
      );
    },
  };
}

export function MessageContent({
  content,
  lang = "ru",
}: {
  content: string;
  lang?: UiLanguage;
}) {
  const markdownComponents = useMemo(
    () => createMarkdownComponents(lang),
    [lang]
  );

  if (!content.trim()) return null;

  const errorPrefix = t(lang, "errorPrefix");
  const isError =
    content.startsWith(errorPrefix) || content.startsWith("Ошибка:");

  return (
    <div
      className={
        isError ? "chat-markdown chat-markdown--error" : "chat-markdown"
      }
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
