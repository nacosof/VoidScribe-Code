import { useEffect, useState } from "react";
export function useElapsedSince(active: boolean, key: string): number { const [start, setStart] = useState(Date.now()); const [now, setNow] = useState(Date.now()); useEffect(() => { setStart(Date.now()); setNow(Date.now()); }, [key]); useEffect(() => { if (!active)
    return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [active]); return Math.max(0, now - start); }
