'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

/** Chip khoảng giá trị / cân nặng: "≥ a", "≤ b", "= a", "a – b"; không cận nào = không chip. */
export function rangeChip(min: string, max: string, fmt: (v: string) => string): string | null {
  if (min && max) return min === max ? `= ${fmt(min)}` : `${fmt(min)} – ${fmt(max)}`;
  if (min) return `≥ ${fmt(min)}`;
  if (max) return `≤ ${fmt(max)}`;
  return null;
}

/**
 * Khoảng cân nặng (kg): gõ xong rồi Enter / rời ô mới áp lên URL — không bắn request theo
 * từng phím. Cùng giá trị hai ô = lọc đúng một mức cân (vd tất cả đơn 1,2 kg).
 * Dùng chung Bán hàng › Đơn hàng và Kho › Đơn hàng (2026-11-06, user "clone phần lọc cân nặng").
 */
export function WeightRangeFilter({
  min,
  max,
  onChange,
}: {
  min: string | undefined;
  max: string | undefined;
  onChange: (next: { weightMin: string | undefined; weightMax: string | undefined }) => void;
}) {
  const [draftMin, setDraftMin] = useState(min ?? '');
  const [draftMax, setDraftMax] = useState(max ?? '');
  useEffect(() => setDraftMin(min ?? ''), [min]);
  useEffect(() => setDraftMax(max ?? ''), [max]);
  const commit = () => {
    const norm = (s: string) => {
      const t = s.trim().replace(',', '.');
      return t === '' || !/^\d{1,8}(\.\d{1,4})?$/.test(t) ? undefined : t;
    };
    const nextMin = norm(draftMin);
    const nextMax = norm(draftMax);
    if (nextMin === min && nextMax === max) return;
    onChange({ weightMin: nextMin, weightMax: nextMax });
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
  };
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <span>Cân nặng</span>
      <Input
        value={draftMin}
        onChange={(e) => setDraftMin(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        placeholder="từ"
        aria-label="Cân nặng từ (kg)"
        className="h-9 w-20 text-right tabular-nums"
      />
      <span>–</span>
      <Input
        value={draftMax}
        onChange={(e) => setDraftMax(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        placeholder="đến"
        aria-label="Cân nặng đến (kg)"
        className="h-9 w-20 text-right tabular-nums"
      />
      <span>kg</span>
    </div>
  );
}
