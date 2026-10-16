'use client';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WarehouseOption } from '@/lib/warehouse';

export interface WarehouseAccessValue {
  /** Kho được phép làm việc. */
  warehouseIds: string[];
  /** Kho mặc định lúc đăng nhập — '' = chưa có; luôn thuộc `warehouseIds`. */
  warehouseId: string;
}

/**
 * Cấp kho cho nhân viên (PLAN-warehouse-context): checkbox kho được phép + chọn kho mặc định trong
 * số đó. `options` = kho NGƯỜI SỬA được phép (chỉ cấp / bỏ được những kho này — server kiểm lại);
 * kho đã cấp nằm ngoài `options` được giữ nguyên và chỉ hiện số lượng.
 */
export function WarehouseAccessField({
  options,
  value,
  onChange,
  disabled,
}: {
  options: WarehouseOption[];
  value: WarehouseAccessValue;
  onChange: (next: WarehouseAccessValue) => void;
  disabled?: boolean;
}) {
  const optionIds = options.map((o) => o.id);
  const foreign = value.warehouseIds.filter((id) => !optionIds.includes(id));
  const allChecked = options.length > 0 && optionIds.every((id) => value.warehouseIds.includes(id));

  const setIds = (ids: string[]) => {
    const unique = [...new Set(ids)];
    // Kho mặc định rơi khỏi danh sách → kho được phép đầu tiên (như server).
    const warehouseId = unique.includes(value.warehouseId) ? value.warehouseId : (unique[0] ?? '');
    onChange({ warehouseIds: unique, warehouseId });
  };
  const chosen = options.filter((o) => value.warehouseIds.includes(o.id));

  return (
    <fieldset className="space-y-2 text-sm" disabled={disabled}>
      <div className="flex items-center justify-between">
        <legend className="font-medium">Kho được phép</legend>
        {options.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(v) => setIds(v === true ? [...foreign, ...optionIds] : foreign)}
              aria-label="Chọn tất cả kho"
            />
            Chọn tất cả
          </label>
        ) : null}
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">Bạn chưa được cấp kho nào để cấp lại.</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2">
              <Checkbox
                checked={value.warehouseIds.includes(o.id)}
                onCheckedChange={(v) =>
                  setIds(
                    v === true
                      ? [...value.warehouseIds, o.id]
                      : value.warehouseIds.filter((id) => id !== o.id),
                  )
                }
                aria-label={o.name}
              />
              <span className="truncate">{o.name}</span>
            </label>
          ))}
        </div>
      )}
      {foreign.length ? (
        <p className="text-xs text-muted-foreground">
          Giữ nguyên {foreign.length} kho bạn không quản lý.
        </p>
      ) : null}
      <div>
        <span className="mb-1 block font-medium">Kho mặc định</span>
        <Select
          value={value.warehouseId || undefined}
          onValueChange={(warehouseId) => onChange({ ...value, warehouseId })}
          disabled={disabled || chosen.length === 0}
        >
          <SelectTrigger aria-label="Kho mặc định">
            <SelectValue placeholder="Chọn kho được phép trước" />
          </SelectTrigger>
          <SelectContent>
            {chosen.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="mt-1 block text-xs text-muted-foreground">
          Kho mở sẵn khi đăng nhập; người đóng gói chỉ nhận đơn cùng kho này.
        </span>
      </div>
    </fieldset>
  );
}
