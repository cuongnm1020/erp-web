'use client';

import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SkuLike {
  skuCode: string;
  skuName: string;
  productName: string;
  imageUrl: string | null;
  lotNumber: string | null;
}

/**
 * Ảnh thu nhỏ của SKU (presigned URL S3 hết hạn ~1h — không đi qua next/image optimizer,
 * cùng lý do với gallery sản phẩm). Không có ảnh → ô xám có icon, giữ đúng chỗ để không nhảy layout.
 */
export function SkuThumb({
  src,
  alt,
  size = 'sm',
  className,
}: {
  src: string | null;
  alt: string;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const box = size === 'lg' ? 'h-24 w-24' : 'h-10 w-10';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted',
        box,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL S3 hết hạn ~1h, không dùng next/image optimizer
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageOff
          className={cn('text-muted-foreground', size === 'lg' ? 'h-8 w-8' : 'h-4 w-4')}
          aria-hidden
        />
      )}
    </span>
  );
}

/**
 * Thẻ nhận diện hàng cho người đi lấy / đóng gói (2026-09-22): ảnh to + TÊN THƯƠNG MẠI (tên
 * người ta gọi ngoài kho) + tên biến thể nếu khác + mã SKU / lô. Không biết gì về task.
 */
export function SkuIdentity({ sku, className }: { sku: SkuLike; className?: string }) {
  const variant = sku.skuName && sku.skuName !== sku.productName ? sku.skuName : null;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <SkuThumb src={sku.imageUrl} alt={sku.productName} size="lg" />
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight">{sku.productName || sku.skuName}</div>
        {variant ? <div className="text-base font-medium">{variant}</div> : null}
        <div className="font-mono text-sm text-muted-foreground">
          {sku.skuCode}
          {sku.lotNumber ? ` · lô ${sku.lotNumber}` : ''}
        </div>
      </div>
    </div>
  );
}
