'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * Cảnh báo khi SKU đang lấy / đóng gói chưa có mã vạch — biết ngay là không quét được (phải
 * gắn mã ở Sản phẩm trước). SKU đã có mã thì không vẽ gì: hình mã vạch trên màn pick / pack
 * đã ẩn theo yêu cầu kho (2026-10-26) — người làm quét tem trên hàng, không cần đối chiếu.
 */
export function SkuBarcodes({ barcodes }: { barcodes: string[] }) {
  if (barcodes.length) return null;
  return (
    <p
      role="status"
      className="mt-2 flex items-center gap-2 rounded-md border border-warning-line bg-warning-weak px-2 py-1.5 text-sm text-foreground"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      SKU chưa có mã vạch — không quét được, gắn mã ở Sản phẩm trước.
    </p>
  );
}
