'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { foldVi } from './form/search-select';

export interface PurposeOption {
  id: string;
  name: string;
}

/**
 * Chọn mục đích sử dụng sản phẩm của khách (Sầu riêng, Cà phê… — biên bản CSKH 2026-10-26, mockup
 * SVf5Yc5pCBTzezpd4rru9Z màn 3): chip bấm để bật / tắt, ô gõ để tạo mục đích mới ngay tại chỗ.
 * Gõ trùng tên (không phân biệt dấu / hoa thường) với mục đích có sẵn → không tạo, nhắc bấm chip.
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
  const dup = typed ? options.find((o) => foldVi(o.name) === foldVi(typed)) : undefined;
  const create = async () => {
    if (!typed || dup || creating) return;
    await onCreate(typed);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mục đích sử dụng">
        {options.map((o) => {
          const isLocked = locked.includes(o.id);
          const on = isLocked || selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
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
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void create();
            }
          }}
          disabled={disabled}
          maxLength={60}
          placeholder="Gõ để tạo mục đích mới, vd. Thanh long"
          aria-label="Tạo mục đích mới"
          className="h-7 flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !typed || !!dup}
          loading={creating}
          onClick={() => void create()}
        >
          <Plus aria-hidden />
          Tạo &amp; gắn
        </Button>
      </div>
      {dup ? (
        <p className="text-xs text-warning" role="status">
          Đã có “{dup.name}” — bấm chip có sẵn thay vì tạo trùng.
        </p>
      ) : null}
    </div>
  );
}
