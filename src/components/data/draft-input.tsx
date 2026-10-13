'use client';

import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';

/**
 * Ô nhập giữ bản nháp cục bộ, chỉ "chốt" ra ngoài (thường là URL qua useListState) sau khi
 * ngừng gõ `delay` ms / Enter / blur. Viết riêng vì gõ tiếng Việt (Telex/VNI qua bộ gõ macOS,
 * EVKey, Unikey) hay bị nát chữ khi ô bám thẳng vào URL:
 *  - router.replace bất đồng bộ → giá trị cũ quay về đè lên chữ vừa gõ thêm;
 *  - ghi đè `value` giữa lúc bộ gõ đang ghép dấu (composition) làm bộ gõ chốt sai.
 * Nên: không chốt khi đang ghép dấu, và giá trị từ ngoài chỉ đè bản nháp khi ô KHÔNG có focus
 * (vd bấm "Xóa lọc"). Giá trị chốt được normalize NFC (bộ gõ có thể sinh dấu tổ hợp NFD).
 */
export type DraftInputProps = Omit<InputProps, 'value' | 'onChange' | 'defaultValue'> & {
  value: string;
  onCommit: (value: string) => void;
  /** ms chờ sau phím cuối; `null` = chỉ chốt khi Enter / blur. */
  delay?: number | null;
  /** Mặc định cắt khoảng trắng hai đầu trước khi chốt. */
  trim?: boolean;
  /** Esc xóa trắng ô (rồi chốt theo `delay`). */
  clearOnEscape?: boolean;
};

export const DraftInput = React.forwardRef<HTMLInputElement, DraftInputProps>(
  (
    {
      value,
      onCommit,
      delay = 300,
      trim = true,
      clearOnEscape = false,
      onKeyDown,
      onBlur,
      onCompositionStart,
      onCompositionEnd,
      ...props
    },
    forwardedRef,
  ) => {
    const ref = React.useRef<HTMLInputElement | null>(null);
    const [draft, setDraft] = React.useState(value);
    const [composing, setComposing] = React.useState(false);
    // Giá trị đã chốt gần nhất / đã nhận từ ngoài — để phân biệt "ngoài đổi thật" với "vọng lại".
    const known = React.useRef(value);

    const clean = React.useCallback(
      (s: string) => {
        const n = s.normalize('NFC');
        return trim ? n.trim() : n;
      },
      [trim],
    );

    const commit = React.useCallback(
      (s: string) => {
        const next = clean(s);
        known.current = next;
        if (next !== value) onCommit(next);
      },
      [clean, value, onCommit],
    );

    React.useEffect(() => {
      if (value === known.current) return;
      known.current = value;
      if (ref.current && document.activeElement === ref.current) return;
      setDraft(value);
    }, [value]);

    React.useEffect(() => {
      if (delay === null || composing || clean(draft) === value) return;
      const t = setTimeout(() => commit(draft), delay);
      return () => clearTimeout(t);
    }, [draft, composing, delay, clean, value, commit]);

    return (
      <Input
        {...props}
        ref={(el) => {
          ref.current = el;
          if (typeof forwardedRef === 'function') forwardedRef(el);
          else if (forwardedRef) forwardedRef.current = el;
        }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onCompositionStart={(e) => {
          setComposing(true);
          onCompositionStart?.(e);
        }}
        onCompositionEnd={(e) => {
          setComposing(false);
          setDraft(e.currentTarget.value);
          onCompositionEnd?.(e);
        }}
        onKeyDown={(e) => {
          // Enter lúc đang ghép dấu là bộ gõ xác nhận chữ, không phải người dùng muốn tìm.
          if (!e.nativeEvent.isComposing && e.key === 'Enter') commit(draft);
          if (clearOnEscape && e.key === 'Escape') setDraft('');
          onKeyDown?.(e);
        }}
        onBlur={(e) => {
          if (clean(draft) !== value) commit(draft);
          onBlur?.(e);
        }}
      />
    );
  },
);
DraftInput.displayName = 'DraftInput';
