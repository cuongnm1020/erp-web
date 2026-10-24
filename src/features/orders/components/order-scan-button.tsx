'use client';

import { Camera } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CameraScanner, isCameraScanSupported } from '@/components/data/camera-scanner';
import { Button } from '@/components/ui/button';

/**
 * Nút "Quét tìm đơn" ở danh sách đơn (2026-10-25): mở camera điện thoại, đọc mã vận đơn (QR / mã vạch
 * tem hãng, đoạn số cuối tem GHTK), số đơn hoặc mã Pancake rồi trả mã cho màn để tìm. Chỉ hiện khi
 * trình duyệt mở được camera (HTTPS + getUserMedia) và ẩn từ màn rộng `lg` (máy tính không quét).
 */
export function OrderScanButton({ onScan }: { onScan: (code: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  // Chỉ biết sau khi lên client (window) — tránh lệch SSR / hydrate.
  useEffect(() => setSupported(isCameraScanSupported()), []);

  if (!supported) return null;
  return (
    <>
      <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setOpen(true)}>
        <Camera aria-hidden />
        Quét tìm đơn
      </Button>
      {open ? (
        <CameraScanner
          title="Tìm đơn bằng camera"
          hint="Đưa mã vận đơn hoặc số đơn vào khung. Máy tự đóng khi đọc được."
          onClose={() => setOpen(false)}
          onDetect={(code) => {
            setOpen(false);
            onScan(code);
          }}
        />
      ) : null}
    </>
  );
}
