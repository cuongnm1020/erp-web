'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { foldVi } from './search-select';

export interface TagsInputProps {
  /** Giá trị đã chọn, theo thứ tự thêm. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Gợi ý khi gõ (vẫn gõ được giá trị ngoài danh sách). */
  suggestions?: string[];
  placeholder?: string;
  /** Số mục tối đa — đủ thì khóa ô gõ. */
  max?: number;
  /** Độ dài tối đa một mục. */
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Nhập NHIỀU giá trị chữ tự do (chip): gõ rồi Enter / dấu phẩy để thêm, Backspace ở ô trống bỏ mục
 * cuối, × trên chip để bỏ. Gợi ý lấy từ `suggestions` (khớp không dấu); trùng (không phân biệt
 * hoa thường / dấu cách thừa) thì bỏ qua.
 */
export const TagsInput = React.forwardRef<HTMLInputElement, TagsInputProps>(function TagsInput(
  {
    value,
    onChange,
    suggestions = [],
    placeholder,
    max = 20,
    maxLength = 100,
    disabled,
    className,
    id,
    'aria-label': ariaLabel,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
  },
  ref,
) {
  const [draft, setDraft] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  /** Đã dùng phím mũi tên chọn gợi ý → Enter lấy gợi ý thay cho chữ đang gõ. */
  const [navigated, setNavigated] = React.useState(false);
  const listId = React.useId();
  const has = (v: string) =>
    value.some((x) => x.toLocaleLowerCase('vi') === v.toLocaleLowerCase('vi'));
  const matches = React.useMemo(() => {
    const q = foldVi(draft.trim());
    return suggestions.filter((s) => !has(s) && (q === '' || foldVi(s).includes(q))).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, suggestions, value]);
  const full = value.length >= max;

  const add = (raw: string) => {
    const v = raw.replace(/\s+/g, ' ').trim().slice(0, maxLength);
    setDraft('');
    setActive(0);
    setNavigated(false);
    if (v === '' || has(v) || full) return;
    onChange([...value, v]);
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const showing = open && matches.length > 0;
    if (e.key === 'ArrowDown' && showing) {
      e.preventDefault();
      setNavigated(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp' && showing) {
      e.preventDefault();
      setNavigated(true);
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      // Đã chọn gợi ý bằng mũi tên (hoặc ô trống) → lấy gợi ý; không thì lấy đúng chữ đã gõ.
      const pick = showing && (navigated || draft.trim() === '') ? matches[active] : undefined;
      add(pick ?? draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value.length - 1);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative flex flex-col gap-1.5', className)}>
      {value.length > 0 ? (
        <ul
          className="flex flex-wrap gap-1"
          aria-label={ariaLabel ? `${ariaLabel} đã chọn` : undefined}
        >
          {value.map((v, i) => (
            <li
              key={v}
              className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-sm"
            >
              {v}
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(i)}
                aria-label={`Bỏ ${v}`}
                className="rounded text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        ref={ref}
        id={id}
        value={draft}
        disabled={disabled || full}
        placeholder={full ? `Đã đủ ${max} mục` : placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
          setActive(0);
          setNavigated(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (draft.trim() !== '') add(draft);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete="off"
      />
      {open && matches.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover py-1 text-popover-foreground shadow-popover"
        >
          {matches.map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                add(m);
              }}
              className={cn(
                'cursor-pointer px-3 py-1.5 text-sm',
                i === active ? 'bg-muted' : 'hover:bg-muted',
              )}
            >
              {m}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
