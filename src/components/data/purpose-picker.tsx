'use client';

import { Plus } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { foldVi } from './form/search-select';

export interface PurposeOption {
  id: string;
  name: string;
  /** Số khách đang dùng — xếp chip dùng nhiều lên trước. */
  customerCount?: number;
}

/** Số gợi ý tối đa khi gõ tên. */
const SUGGEST_LIMIT = 8;

/**
 * Chọn mục đích sử dụng sản phẩm của khách (Sầu riêng, Cà phê… — biên bản CSKH 2026-10-26, mockup
 * SVf5Yc5pCBTzezpd4rru9Z màn 3).
 * - Chip: chỉ HAI DÒNG (2026-10-28) — khách đã có trước, rồi dùng nhiều nhất (`customerCount`);
 *   bấm bật / tắt không đổi thứ tự. Chip tràn xuống dòng 3 bị cắt và rời khỏi thứ tự Tab.
 * - Ô gõ: gợi ý mục đích có sẵn khớp tên (không phân biệt dấu / hoa thường) — bấm để bật; tên chưa
 *   có thì "Tạo & gắn". Enter: trùng tên → bật mục đích đó, không thì tạo mới.
 * `locked` = mục đích khách đã có — hiện bật, không tắt được ở đây (gỡ ở hồ sơ khách).
 * Không biết module nào (luật 12): danh sách + tạo mới do feature truyền vào.
 */
export function PurposePicker({
  options,
  selected,
  locked = [],
  onToggle,
  onCreate,
  creating,
  disabled,
}: {
  options: readonly PurposeOption[];
  selected: readonly string[];
  locked?: readonly string[];
  onToggle: (id: string) => void;
  /** Tạo + chọn mục đích mới; resolve khi xong. */
  onCreate: (name: string) => void | Promise<void>;
  creating?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const typed = draft.trim().replace(/\s+/g, ' ');
  const isOn = (id: string) => locked.includes(id) || selected.includes(id);

  // Thứ tự KHÔNG theo `selected` (bấm chip không làm chip nhảy chỗ): khách đã có → chip được kéo
  // lên (`pinned`) → dùng nhiều nhất. Mục đích bật mà đang nằm ở dòng bị cắt (chọn từ gợi ý, vừa
  // tạo, nháp cũ) thì kéo lên sau nhóm khách đã có, và giữ chỗ đó kể cả khi tắt lại.
  const [pinned, setPinned] = useState<string[]>([]);
  const ranked = useMemo(() => {
    const byUsage = [...options].sort(
      (a, b) =>
        (b.customerCount ?? 0) - (a.customerCount ?? 0) || a.name.localeCompare(b.name, 'vi'),
    );
    const rank = (o: PurposeOption) => (locked.includes(o.id) ? 0 : pinned.includes(o.id) ? 1 : 2);
    return byUsage
      .map((o, i) => ({ o, i }))
      .sort(
        (a, b) =>
          rank(a.o) - rank(b.o) ||
          (rank(a.o) === 1 ? pinned.indexOf(a.o.id) - pinned.indexOf(b.o.id) : a.i - b.i),
      )
      .map((x) => x.o);
  }, [options, locked, pinned]);

  const q = foldVi(typed);
  const dup = typed ? options.find((o) => foldVi(o.name) === q) : undefined;
  const suggestions = typed
    ? ranked.filter((o) => foldVi(o.name).includes(q)).slice(0, SUGGEST_LIMIT)
    : [];

  // Chip nằm ở dòng thứ 3 trở đi (bị max-h cắt) → không nhận focus, trình đọc màn hình bỏ qua.
  const rowRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(Infinity);
  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => {
      const chips = Array.from(el.children) as HTMLElement[];
      const tops = [...new Set(chips.map((c) => c.offsetTop))].sort((a, b) => a - b);
      const cut = tops[2];
      setVisible(cut === undefined ? Infinity : chips.findIndex((c) => c.offsetTop >= cut));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ranked]);

  useLayoutEffect(() => {
    const hidden = selected.filter((id) => {
      const i = ranked.findIndex((o) => o.id === id);
      return i >= visible && !pinned.includes(id);
    });
    if (hidden.length > 0) setPinned((p) => [...p, ...hidden]);
  }, [selected, ranked, visible, pinned]);

  const pick = (id: string) => {
    if (!isOn(id)) onToggle(id);
    setDraft('');
  };
  const submit = async () => {
    if (!typed || creating) return;
    if (dup) return pick(dup.id);
    await onCreate(typed);
    setDraft('');
  };

  const chip = (o: PurposeOption, hidden = false) => {
    const isLocked = locked.includes(o.id);
    const on = isOn(o.id);
    return (
      <button
        key={o.id}
        type="button"
        aria-pressed={on}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : undefined}
        disabled={disabled || isLocked}
        title={isLocked ? 'Khách đã có mục đích này — gỡ ở hồ sơ khách' : undefined}
        onClick={() => onToggle(o.id)}
        className={cn(
          'inline-flex h-7 items-center rounded-chip border px-2.5 text-sm',
          on
            ? 'border-success bg-success-weak font-semibold text-success'
            : 'border-input bg-card text-foreground hover:bg-muted',
          isLocked && 'cursor-default',
        )}
      >
        {o.name}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={rowRef}
        className="flex max-h-16 flex-wrap gap-1.5 overflow-hidden"
        role="group"
        aria-label="Mục đích sử dụng"
      >
        {ranked.map((o, i) => chip(o, i >= visible))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape' && draft) {
              e.preventDefault();
              setDraft('');
            }
          }}
          disabled={disabled}
          maxLength={60}
          placeholder="Tìm hoặc tạo mục đích, vd. Thanh long"
          aria-label="Tìm hoặc tạo mục đích"
          className="h-7 flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !typed || !!dup}
          loading={creating}
          onClick={() => void submit()}
        >
          <Plus aria-hidden />
          Tạo &amp; gắn
        </Button>
      </div>
      {typed ? (
        suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Gợi ý mục đích">
            {suggestions.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={isOn(o.id)}
                disabled={disabled || isOn(o.id)}
                onClick={() => pick(o.id)}
                className={cn(
                  'inline-flex h-7 items-center rounded-chip border px-2.5 text-sm',
                  isOn(o.id)
                    ? 'border-success bg-success-weak font-semibold text-success'
                    : 'border-input bg-card text-foreground hover:bg-muted',
                )}
              >
                {o.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground" role="status">
            Chưa có “{typed}” — bấm Tạo &amp; gắn hoặc Enter để tạo mới.
          </p>
        )
      ) : null}
    </div>
  );
}
