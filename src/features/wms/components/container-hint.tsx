'use client';

import { Box } from 'lucide-react';
import { Barcode } from '@/components/data/barcode';
import { formatQuantity } from '@/lib/format';
import type { components } from '@/lib/api/schema';

type Suggestion = components['schemas']['PickSuggestionDto'];

/**
 * PLAN-packaging-hierarchy E/F — thùng/kiện đã xếp cho dòng đang làm (quét mã này là lấy cả
 * thùng, không cần quét từng sản phẩm) và gợi ý tổ hợp "2 kiện + 3 thùng + 50 cái" cho phần còn
 * lại. Không có cấp đóng gói → không hiện gì.
 */
export function ContainerHint({
  containerBarcode,
  suggested,
}: {
  containerBarcode?: string | null;
  suggested?: Suggestion[] | null;
}) {
  const chips = suggested ?? [];
  if (!containerBarcode && chips.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {containerBarcode ? (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
          <div className="flex items-center gap-1 text-xs font-medium text-primary">
            <Box className="h-3.5 w-3.5" aria-hidden />
            Thùng đã xếp — quét mã thùng để lấy trọn
          </div>
          <Barcode value={containerBarcode} symbology="code128" height={8} scale={2} />
          <div className="font-mono text-sm font-semibold">{containerBarcode}</div>
        </div>
      ) : null}
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-1 text-xs" aria-label="Gợi ý lấy hàng">
          {chips.map((s) => (
            <li
              key={s.uomId}
              className="rounded border px-1.5 py-0.5 font-medium tabular-nums text-muted-foreground"
            >
              {formatQuantity(s.count)} {s.uomCode}
              {s.containerTypeCode ? ` (${s.containerTypeCode.toLowerCase()})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
