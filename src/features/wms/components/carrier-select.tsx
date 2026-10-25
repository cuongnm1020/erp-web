'use client';

import type { ComponentPropsWithoutRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  carrierAccountLabel,
  carrierAccountOptions,
  findCarrierOption,
  useCarriers,
  type Carrier,
  type CarrierAccountOption,
} from '../api/use-shipping';

/** Hãng + tài khoản đã chọn. `accountId` null = tài khoản mặc định của hãng. */
export interface CarrierValue {
  carrierId: string;
  accountId: string | null;
}

/** Dòng đặc biệt đầu danh sách: "Mọi hãng", "Chưa chọn hãng", "Giữ nguyên"… */
export interface CarrierSelectSpecial {
  value: string;
  label: string;
}

export interface CarrierSelectProps {
  /** Hãng + tài khoản đang chọn, hoặc `value` của một dòng đặc biệt; null = chưa chọn gì. */
  value: CarrierValue | string | null;
  /**
   * Chọn một tài khoản → `{ carrierId, accountId }` + dòng đã chọn (`accountId` của tài khoản
   * MẶC ĐỊNH trả null — "theo mặc định của hãng", cùng nghĩa với đơn chưa chọn tài khoản).
   * Chọn dòng đặc biệt → chuỗi `value` của dòng đó.
   */
  onChange: (next: CarrierValue | string, option?: CarrierAccountOption) => void;
  specials?: CarrierSelectSpecial[];
  /** Lọc thêm (vd chỉ hãng có adapter). */
  filter?: (o: CarrierAccountOption) => boolean;
  /** Chữ thêm sau nhãn một dòng (vd " (không in nhãn được)"). */
  suffix?: (o: CarrierAccountOption) => string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
  triggerProps?: Omit<ComponentPropsWithoutRef<typeof SelectTrigger>, 'id' | 'className'>;
}

const SEP = '|';

/** Tài khoản đã lưu không còn trong danh sách (hãng tắt / tài khoản chưa cấu hình) — vẫn hiện tên. */
function staleLabel(carriers: Carrier[] | undefined, v: CarrierValue): string | null {
  const c = carriers?.find((x) => x.id === v.carrierId);
  if (!c) return null;
  const a = v.accountId ? c.accounts.find((x) => x.id === v.accountId) : undefined;
  const label = a ? `${c.code} ${carrierAccountLabel(c, a)}` : c.name;
  return `${label}${c.isActive ? ' — chưa cấu hình' : ' — đã tắt'}`;
}

/**
 * Ô chọn hãng vận chuyển DÙNG CHUNG mọi màn (2026-10-25): chỉ hãng đang bật + tài khoản đủ cấu
 * hình, không dòng cấp hãng — mỗi tài khoản một dòng "GHTK S23119447 Nam Việt - Hàng Lòng"
 * ({@link carrierAccountOptions}). Giá trị đã lưu mà hãng / tài khoản không còn dùng được vẫn
 * hiện (kèm "đã tắt" / "chưa cấu hình") để không mất thông tin trên đơn cũ.
 */
export function CarrierSelect({
  value,
  onChange,
  specials = [],
  filter,
  suffix,
  placeholder,
  disabled,
  id,
  'aria-label': ariaLabel = 'Hãng vận chuyển',
  className,
  triggerProps,
}: CarrierSelectProps) {
  const carriers = useCarriers();
  const all = carrierAccountOptions(carriers.data);
  const options = filter ? all.filter(filter) : all;

  let selected = '';
  let stale: { value: string; label: string } | null = null;
  if (typeof value === 'string') selected = value;
  else if (value) {
    const hit = findCarrierOption(options, value.carrierId, value.accountId);
    if (hit) selected = hit.value;
    else {
      selected = `${value.carrierId}${SEP}${value.accountId ?? ''}`;
      const label = staleLabel(carriers.data, value);
      stale = label ? { value: selected, label } : null;
    }
  }

  const pick = (v: string) => {
    const option = options.find((o) => o.value === v);
    if (!option) {
      if (specials.some((s) => s.value === v)) onChange(v);
      return;
    }
    const isDefault =
      option.accountId !== null &&
      option.carrier.accounts.find((a) => a.id === option.accountId)?.isDefault === true;
    onChange(
      { carrierId: option.carrier.id, accountId: isDefault ? null : option.accountId },
      option,
    );
  };

  return (
    <Select value={selected || undefined} onValueChange={pick} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={className} {...triggerProps}>
        <SelectValue
          placeholder={carriers.isPending ? 'Đang tải hãng…' : (placeholder ?? 'Chọn hãng…')}
        />
      </SelectTrigger>
      <SelectContent>
        {specials.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
        {stale ? (
          <SelectItem value={stale.value} disabled>
            {stale.label}
          </SelectItem>
        ) : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
            {suffix?.(o) ?? ''}
          </SelectItem>
        ))}
        {options.length === 0 && !carriers.isPending ? (
          <SelectItem value="__empty__" disabled>
            Chưa có hãng vận chuyển nào được cấu hình
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
