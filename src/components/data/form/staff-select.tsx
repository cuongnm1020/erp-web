'use client';

import * as React from 'react';
import { SearchSelect, type SearchSelectOption, type SearchSelectProps } from './search-select';

export interface StaffSelectItem {
  id: string;
  fullName: string;
  /** Mã / tài khoản nhân viên — hiện mờ bên phải và tìm được theo. */
  code?: string | null;
  /** Chữ phụ thay cho code (vai trò, số việc đang làm…). */
  hint?: string;
}

export interface StaffSelectProps extends Omit<SearchSelectProps, 'options'> {
  staff: StaffSelectItem[];
}

export function staffOptions(staff: StaffSelectItem[]): SearchSelectOption[] {
  return staff.map((s) => ({
    value: s.id,
    label: s.fullName,
    hint: s.hint ?? s.code ?? undefined,
  }));
}

/**
 * Ô chọn nhân viên dùng chung (trưởng phòng, gán việc, người nhận, bộ lọc nhân viên…): danh sách
 * đã tải sẵn, gõ tìm theo tên hoặc mã không phân biệt dấu. Màn tự lấy danh bạ qua hook của feature.
 */
export const StaffSelect = React.forwardRef<HTMLButtonElement, StaffSelectProps>(
  ({ staff, placeholder = 'Chọn nhân viên…', ...props }, ref) => {
    const options = React.useMemo(() => staffOptions(staff), [staff]);
    return (
      <SearchSelect
        ref={ref}
        options={options}
        placeholder={placeholder}
        searchPlaceholder="Tìm theo tên hoặc mã…"
        emptyText="Không có nhân viên khớp"
        {...props}
      />
    );
  },
);
StaffSelect.displayName = 'StaffSelect';
