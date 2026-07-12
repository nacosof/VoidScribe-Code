import { useCallback, useEffect, useRef, useState } from "react";
import { USER_AI_PROVIDER_CONFIG } from "@/lib/providers";
import { createId } from "@/lib/chat-sessions";
import { insertNewlineAtCursor } from "@/lib/composer-input";
import { useChatSessions } from "@/hooks/useChatSessions";
import type { ChatMessage, SettingsPublic } from "@/types";
import { AssistantSetupPrompt } from "./components/AssistantSetupPrompt";
import { ChatTabsBar } from "./components/ChatTabsBar";
import { MessageList } from "./components/MessageList";
import { SettingsScreen } from "./components/SettingsScreen";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";

type AppView = "chat" | "settings";

type ActiveRequest = {
  sessionId: string;
  messageId: string;
};

export default function App() {
  const [settings, setSettings] = useState<SettingsPublic | null>(null);
  const [view, setView] = useState<AppView>("chat");
  const [isStreaming, setIsStreaming] = useState(false);
  const [setupPromptOpen, setSetupPromptOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef<ActiveRequest | null>(null);

  const {
    sessions,
    activeSession,
    activeId,
    selectSession,
    createSession,
    closeSession,
    updateActiveDraft,
    appendMessages,
    patchMessage,
    clearActiveDraft,
  } = useChatSessions();

  const customTitleBar = window.voidscribe.hasCustomTitleBar;
  const input = activeSession.draft;
  const messages = activeSession.messages;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    void window.voidscribe.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (view === "chat") scrollToBottom();
  }, [messages, isStreaming, view, activeId, scrollToBottom]);

  useEffect(() => {
    return window.voidscribe.onStreamChunk((chunk) => {
      const active = activeRequestRef.current;
      if (!active || chunk.requestId !== active.messageId) return;

      if (chunk.error) {
        patchMessage(
          active.sessionId,
          active.messageId,
          `Ошибка: ${chunk.error}`
        );
        setIsStreaming(false);
        activeRequestRef.current = null;
        return;
      }

      if (chunk.delta) {
        setSessionsFromStream(active, chunk.delta);
      }

      if (chunk.done) {
        setIsStreaming(false);
        activeRequestRef.current = null;
      }
    });
  }, []);

  function setSessionsFromStream(active: ActiveRequest, delta: string) {
    patchMessage(
      active.sessionId,
      active.messageId,
      getStreamedContent(active) + delta
    );
  }

  function getStreamedContent(active: ActiveRequest): string {
    const session = sessions.find((s) => s.id === active.sessionId);
    const message = session?.messages.find((m) => m.id === active.messageId);
    return message?.content ?? "";
  }

  async function handleSelectWorkspace() {
    const path = await window.voidscribe.selectWorkspace();
    if (path) {
      setSettings((prev) => (prev ? { ...prev, workspacePath: path } : prev));
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    if (!settings?.hasApiKey) {
      setSetupPromptOpen(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    const assistantId = createId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    const history = [...messages, userMessage];
    appendMessages(activeSession.id, [userMessage, assistantMessage]);
    clearActiveDraft();
    setIsStreaming(true);
    activeRequestRef.current = {
      sessionId: activeSession.id,
      messageId: assistantId,
    };

    await window.voidscribe.sendMessage(history, assistantId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { value, caret } = insertNewlineAtCursor(
        input,
        el.selectionStart,
        el.selectionEnd
      );
      updateActiveDraft(value);
      requestAnimationFrame(() => {
        el.selectionStart = caret;
        el.selectionEnd = caret;
      });
      return;
    }

    if (e.shiftKey) return;

    e.preventDefault();
    void handleSend();
  }

  if (!settings) {
    return (
      <div className="app-frame">
        {customTitleBar ? <TitleBar /> : null}
        <div className="app-shell" style={{ placeItems: "center" }}>
          <p style={{ color: "var(--stardust-gray)" }}>Загрузка…</p>
        </div>
      </div>
    );
  }

  const providerLabel = USER_AI_PROVIDER_CONFIG[settings.provider].label;

  return (
    <div className="app-frame">
      {customTitleBar ? <TitleBar /> : null}
      <div className={`app-shell${sidebarOpen ? "" : " app-shell--collapsed"}`}>
        <div className="sidebar-panel">
          <Sidebar
            workspacePath={settings.workspacePath}
            providerLabel={providerLabel}
            model={settings.model}
            hasApiKey={settings.hasApiKey}
            onSelectWorkspace={handleSelectWorkspace}
            onOpenSettings={() => setView("settings")}
          />
        </div>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={sidebarOpen ? "Скрыть панель" : "Показать панель"}
          title={sidebarOpen ? "Скрыть панель" : "Показать панель"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {sidebarOpen ? (
              <path d="M15 18l-6-6 6-6" />
            ) : (
              <path d="M9 18l6-6-6-6" />
            )}
          </svg>
        </button>

        <main className="main">
          {view === "settings" ? (
            <SettingsScreen
              settings={settings}
              onBack={() => setView("chat")}
              onSaved={setSettings}
            />
          ) : (
            <>
              <ChatTabsBar
                sessions={sessions}
                activeId={activeId}
                isStreaming={isStreaming}
                onSelect={selectSession}
                onClose={closeSession}
                onCreate={createSession}
              />

              <div className="messages">
                <MessageList messages={messages} isStreaming={isStreaming} />
                <div ref={messagesEndRef} />
              </div>

              <footer className="composer">
                <div className="composer__box">
                  <textarea
                    className="composer__input"
                    rows={1}
                    value={input}
                    onChange={(e) => updateActiveDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Опишите задачу: исправить баг, написать компонент, объяснить код…"
                    disabled={isStreaming}
                  />
                  <button
                    type="button"
                    className="btn-send"
                    onClick={() => void handleSend()}
                    disabled={isStreaming || !input.trim()}
                    aria-label="Отправить"
                    title="Отправить"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 19V5" />
                      <path d="M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </footer>
            </>
          )}
        </main>

        <AssistantSetupPrompt
          open={setupPromptOpen}
          onClose={() => setSetupPromptOpen(false)}
          onOpenSettings={() => {
            setSetupPromptOpen(false);
            setView("settings");
          }}
        />
      </div>
    </div>
  );
}
