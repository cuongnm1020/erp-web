'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/cn';

interface Metrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

/** Theo dõi kích thước cuộn ngang của vùng bảng (đổi cột, đổi cỡ cửa sổ, dữ liệu về). */
function useScrollMetrics(ref: RefObject<HTMLDivElement | null>): Metrics {
  const [m, setM] = useState<Metrics>({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () =>
      setM((prev) =>
        prev.scrollLeft === el.scrollLeft &&
        prev.scrollWidth === el.scrollWidth &&
        prev.clientWidth === el.clientWidth
          ? prev
          : { scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth },
      );
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, [ref]);
  return m;
}

/** Phần tử bấm được bên trong bảng — kéo bắt đầu từ đây thì không cuộn (để còn bấm / chọn chữ ô nhập). */
const INTERACTIVE =
  'a,button,input,select,textarea,label,[role="checkbox"],[role="combobox"],[contenteditable="true"]';
const DRAG_THRESHOLD = 5;

/**
 * Giữ chuột trái trên bảng rồi kéo để cuộn ngang. Kéo quá 5px thì nuốt cú click kết thúc (không
 * mở dòng). Chỉ chuột — cảm ứng / bút đã có cuộn gốc.
 */
export function useDragScroll(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startX = 0;
    let startLeft = 0;
    let active = false;
    let moved = false;

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        setDragging(true);
        document.body.style.userSelect = 'none';
      }
      el.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved) {
        setDragging(false);
        // Click ngay sau khi thả là của cú kéo — chặn một lần.
        const swallow = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        el.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      active = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    el.addEventListener('pointerdown', onDown);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      onUp();
    };
  }, [ref, enabled]);
  return dragging;
}

/**
 * Thanh cuộn ngang tự vẽ, dính đáy màn hình khi bảng rộng hơn khung: luôn nhìn thấy (thanh gốc
 * của macOS ẩn khi không cuộn, và nằm tận đáy bảng dài). Kéo con trượt hoặc bấm vào rãnh để cuộn.
 */
export function StickyHorizontalScrollbar({
  targetRef,
  className,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const { scrollLeft, scrollWidth, clientWidth } = useScrollMetrics(targetRef);
  const trackRef = useRef<HTMLDivElement>(null);
  const overflow = scrollWidth - clientWidth;

  const scrollTo = useCallback(
    (left: number) => {
      const el = targetRef.current;
      if (el) el.scrollLeft = Math.max(0, Math.min(left, el.scrollWidth - el.clientWidth));
    },
    [targetRef],
  );

  if (overflow <= 1 || clientWidth === 0) return null;
  const ratio = clientWidth / scrollWidth;
  const thumbPct = Math.max(ratio * 100, 8);
  const leftPct = (scrollLeft / overflow) * (100 - thumbPct);

  const onThumbDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const startX = e.clientX;
    const startLeft = scrollLeft;
    const pxPerPx = overflow / (track.clientWidth * (1 - thumbPct / 100));
    const move = (ev: PointerEvent) => scrollTo(startLeft + (ev.clientX - startX) * pxPerPx);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    scrollTo(frac * scrollWidth - clientWidth / 2);
  };

  return (
    <div
      className={cn('sticky bottom-0 z-30 border-t bg-card px-1 py-1', className)}
      data-testid="table-hscroll"
    >
      <div
        ref={trackRef}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-label="Cuộn ngang bảng"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((scrollLeft / overflow) * 100)}
        aria-controls={targetRef.current?.id}
        tabIndex={-1}
        onPointerDown={onTrackDown}
        className="relative h-2.5 cursor-pointer rounded-full bg-muted"
      >
        <div
          onPointerDown={onThumbDown}
          className="absolute inset-y-0 cursor-grab rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/60 active:cursor-grabbing"
          style={{ width: `${thumbPct}%`, left: `${leftPct}%` }}
        />
      </div>
    </div>
  );
}
