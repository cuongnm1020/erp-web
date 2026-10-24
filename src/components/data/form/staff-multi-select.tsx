'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';
import { StaffSelect, type StaffSelectItem } from './staff-select';

export interface StaffMultiSelectProps {
  /** Id đã chọn, theo thứ tự hiển thị. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Người chọn được — gồm cả người đã chọn (để hiện tên). */
  staff: StaffSelectItem[];
  /** Tên vai trò cho nhãn đọc màn hình: "trưởng phòng" → "Bỏ Lê A khỏi trưởng phòng". */
  roleLabel: string;
  /** Chữ trên ô thêm, vd "Thêm trưởng phòng…". */
  addPlaceholder: string;
  /** Người không được chọn ở đây (đang giữ vai trò khác) — ẩn khỏi ô thêm. */
  exclude?: string[];
  /** Chữ phụ riêng cho người đã chọn (vd "6 nhân viên"); mặc định = mã nhân viên. */
  hintOf?: (id: string) => string | undefined;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-describedby'?: string;
}

/**
 * Chọn NHIỀU nhân viên (trưởng phòng, trưởng nhóm…): danh sách người đã chọn, mỗi dòng một nút bỏ,
 * dưới là ô {@link StaffSelect} để thêm người — gõ tìm theo tên / mã không dấu.
 */
export function StaffMultiSelect({
  value,
  onChange,
  staff,
  roleLabel,
  addPlaceholder,
  exclude = [],
  hintOf,
  disabled,
  className,
  id,
  'aria-describedby': describedBy,
}: StaffMultiSelectProps) {
  const byId = React.useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const addable = React.useMemo(
    () => staff.filter((s) => !value.includes(s.id) && !exclude.includes(s.id)),
    [staff, value, exclude],
  );
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {value.length > 0 ? (
        <ul className="rounded-lg border">
          {value.map((sid) => {
            const s = byId.get(sid);
            const name = s?.fullName ?? sid;
            const hint = hintOf?.(sid) ?? s?.code ?? undefined;
            return (
              <li
                key={sid}
                className="flex items-center gap-2 border-b py-1 pl-2.5 pr-1 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate" title={name}>
                  {name}
                  {hint ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Bỏ ${name} khỏi ${roleLabel}`}
                  onClick={() => onChange(value.filter((x) => x !== sid))}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <StaffSelect
        id={id}
        aria-describedby={describedBy}
        aria-label={addPlaceholder.replace(/…$/, '')}
        value=""
        onChange={(sid) => sid && onChange([...value, sid])}
        staff={addable}
        placeholder={addPlaceholder}
        disabled={disabled || addable.length === 0}
      />
    </div>
  );
}
