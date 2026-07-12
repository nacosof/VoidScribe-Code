import { useEffect, useRef, useState } from "react";

export function useElapsedSince(isActive: boolean, resetKey: string): number {
  const startedAtRef = useRef<number | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isActive) {
      startedAtRef.current = null;
      setSeconds(0);
      return;
    }

    startedAtRef.current = Date.now();
    setSeconds(0);

    const id = window.setInterval(() => {
      if (!startedAtRef.current) return;
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [isActive, resetKey]);

  return seconds;
}
