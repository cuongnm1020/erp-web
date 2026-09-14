'use client';

// `bwip-js/browser`: entry gốc chỉ khai điều kiện browser/node trong `exports` nên TS
// (moduleResolution bundler) không thấy type; bản browser có `types` và `toSVG` thuần JS.
import bwipjs from 'bwip-js/browser';
import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { symbologyFor, type ApiBarcodeType, type Symbology } from '@/lib/print';

export interface BarcodeProps {
  /** Chuỗi cần mã hoá — mã SKU, barcode, số chứng từ… */
  value: string;
  /** Ký hiệu render; hoặc truyền `apiType` để suy từ `Barcode.type` của API. */
  symbology?: Symbology;
  apiType?: ApiBarcodeType;
  /** Chiều cao vạch (đơn vị bwip-js ≈ mm ở scale 1). Bỏ qua với QR. */
  height?: number;
  /** Hệ số phóng module (1 = 1 px/module). */
  scale?: number;
  /** In chuỗi dưới vạch. */
  showText?: boolean;
  className?: string;
  /** Nhãn cho screen reader; mặc định "Mã vạch <value>". */
  label?: string;
}

/**
 * bwip-js `toSVG` chỉ cho `viewBox`, KHÔNG có `width`/`height`. SVG như vậy đặt trong
 * hộp co theo nội dung (span inline-block, ô bảng, flex item) tính ra rộng 0 → phiếu in
 * trống chỗ mã vạch (bug prod 2026-09-15). Gắn kích thước gốc theo viewBox (1 đơn vị = 1px
 * ở scale đã chọn); `max-w-full` + `h-auto` ở container vẫn co lại khi hộp hẹp hơn.
 */
export function withIntrinsicSize(svg: string): string {
  return svg.replace(
    /<svg\b([^>]*?)\sviewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/,
    (m, attrs: string, w: string, h: string) =>
      /\swidth=/.test(attrs)
        ? m
        : `<svg${attrs} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"`,
  );
}

/**
 * Mã vạch THẬT (SVG, bwip-js) — dùng cho tem SKU, phiếu đơn, phiếu pick, và mọi chỗ cần
 * máy quét đọc được. Không phải trang trí: dải vạch giả trong mock cũ đã bỏ.
 * Mã không mã hoá được (chuỗi rỗng, ký tự ngoài bảng) → hiện chuỗi thô để không im lặng.
 */
export function Barcode({
  value,
  symbology,
  apiType = 'INTERNAL',
  height = 10,
  scale = 2,
  showText = true,
  className,
  label,
}: BarcodeProps) {
  const bcid = symbology ?? symbologyFor(apiType, value);
  const svg = useMemo(() => {
    if (!value) return null;
    try {
      return withIntrinsicSize(
        bwipjs.toSVG({
          bcid,
          text: value,
          scale,
          ...(bcid === 'qrcode' ? {} : { height, includetext: showText, textxalign: 'center' }),
        }),
      );
    } catch {
      return null;
    }
  }, [bcid, value, scale, height, showText]);

  if (!svg) {
    return (
      <span className={cn('font-mono text-xs', className)} data-barcode-fallback>
        {value || '—'}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={label ?? `Mã vạch ${value}`}
      data-barcode={bcid}
      className={cn('inline-block [&>svg]:h-auto [&>svg]:max-w-full', className)}
      // SVG do bwip-js sinh từ chuỗi của chính mình — không có HTML người dùng.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
