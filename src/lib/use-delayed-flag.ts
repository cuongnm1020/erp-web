import { useEffect, useRef, useState } from 'react';

/**
 * Cờ "đang tải" để HIỂN THỊ (mockup trạng thái tải 2026-11-06): request xong dưới `delay` ms thì
 * không hiện gì (tránh nháy); đã hiện thì giữ ít nhất `min` ms rồi mới tắt.
 */
export function useDelayedFlag(active: boolean, { delay = 150, min = 300 } = {}): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (active) {
      if (shown) return;
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, delay);
      return () => clearTimeout(t);
    }
    if (!shown) return;
    const left = Math.max(0, min - (Date.now() - shownAt.current));
    const t = setTimeout(() => setShown(false), left);
    return () => clearTimeout(t);
  }, [active, shown, delay, min]);

  return shown;
}

/** true khi `active` kéo dài liên tục quá `after` ms (báo "phản hồi chậm"). */
export function useElapsedFlag(active: boolean, after: number): boolean {
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!active) {
      setOver(false);
      return;
    }
    const t = setTimeout(() => setOver(true), after);
    return () => clearTimeout(t);
  }, [active, after]);
  return over;
}
