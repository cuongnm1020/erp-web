'use client';

import { AlertTriangle } from 'lucide-react';
import { Barcode } from '@/components/data/barcode';

/**
 * Mã vạch của SKU đang lấy / cất — người làm nhìn để đối chiếu với tem trên hàng, và khi
 * SKU chưa có mã thì biết ngay là không quét được (phải gắn mã ở Sản phẩm trước).
 */
export function SkuBarcodes({ barcodes }: { barcodes: string[] }) {
  const [first, ...rest] = barcodes;
  if (!first) {
    return (
      <p
        role="status"
        className="mt-2 flex items-center gap-2 rounded border border-warning/60 bg-warning/10 px-2 py-1.5 text-sm text-warning-foreground"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        SKU chưa có mã vạch — không quét được, gắn mã ở Sản phẩm trước.
      </p>
    );
  }
  return (
    <div className="mt-2">
      <Barcode value={first} symbology="code128" height={8} scale={2} />
      {rest.length ? (
        <div className="font-mono text-xs text-muted-foreground">Mã khác: {rest.join(' · ')}</div>
      ) : null}
    </div>
  );
}
