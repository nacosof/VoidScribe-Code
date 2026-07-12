import { useCallback, useEffect, useRef } from "react";

const STICK_THRESHOLD_PX = 96;

export function useStickToBottomScroll(triggerScroll: unknown) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance <= STICK_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const pinToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom("auto");
  }, [triggerScroll, scrollToBottom]);

  return { containerRef, onScroll, pinToBottom };
}
