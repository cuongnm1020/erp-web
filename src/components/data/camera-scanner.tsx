'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createBarcodeReader } from '@/lib/barcode-detector';
import { beep } from '@/lib/beep';

export { isCameraScanSupported } from '@/lib/barcode-detector';

/**
 * Quét mã vạch bằng camera điện thoại (2026-10-24, kiện hoàn về; sau này dùng cho tra đơn). Bộ đọc
 * từ `lib/barcode-detector`: `BarcodeDetector` có sẵn (Chrome Android) hoặc ponyfill ZXing
 * (WebAssembly) cho mọi trình duyệt trên iPhone — đọc CODE128, QR, EAN. Không biết gì về nghiệp vụ
 * (luật 12): đọc được một mã thì bíp + rung, gọi `onDetect` rồi để màn gọi đóng.
 */

const SCAN_INTERVAL_MS = 200;

type TorchTrack = Omit<MediaStreamTrack, 'getCapabilities'> & {
  getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean };
};

export interface CameraScannerProps {
  /** Mã đọc được (đã trim). Gọi đúng một lần mỗi lần mở. */
  onDetect: (code: string) => void;
  onClose: () => void;
  title: string;
  hint: string;
}

/** Lớp phủ toàn màn: video camera sau + khung ngắm; Đóng / Bật đèn / Nhập tay (= đóng). */
export function CameraScanner({ onDetect, onClose, title, hint }: CameraScannerProps) {
  const video = useRef<HTMLVideoElement | null>(null);
  const track = useRef<TorchTrack | null>(null);
  const done = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const detectRef = useRef(onDetect);
  detectRef.current = onDetect;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        // Song song: xin camera trong lúc nạp bộ đọc (iPhone tải ~1 MB WebAssembly lần đầu).
        const readerP = createBarcodeReader();
        readerP.catch(() => undefined); // lỗi xử lý ở `await readerP`; tránh unhandled khi camera lỗi trước
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) return;
        const el = video.current;
        if (!el) return;
        el.srcObject = stream;
        await el.play();
        const t = stream.getVideoTracks()[0] as TorchTrack | undefined;
        track.current = t ?? null;
        if (t?.getCapabilities?.().torch) setTorch(false);
        const detector = await readerP;
        if (cancelled) return;
        setReady(true);

        const tick = async () => {
          if (cancelled || done.current) return;
          try {
            const found = await detector.detect(el);
            const code = found.map((b) => b.rawValue.trim()).find((v) => v.length > 0);
            if (code && !done.current) {
              done.current = true;
              beep('ok');
              navigator.vibrate?.(80);
              detectRef.current(code);
              return;
            }
          } catch {
            // Khung hình chưa sẵn sàng — thử lại ở nhịp sau.
          }
          timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        };
        void tick();
      } catch (err) {
        if (cancelled) return;
        const denied = err instanceof DOMException && err.name === 'NotAllowedError';
        setError(
          denied
            ? 'Chưa cho phép dùng camera — bật quyền camera cho trang này trong cài đặt trình duyệt.'
            : 'Không mở được camera hoặc bộ đọc mã — gõ mã bằng tay.',
        );
      }
    };
    void start();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleTorch = async () => {
    const t = track.current;
    if (!t || torch === null) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-foreground text-card"
    >
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <Button
          variant="outline"
          className="h-pda-touch bg-transparent px-4 text-base text-card"
          onClick={onClose}
        >
          Đóng
        </Button>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={video}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          aria-hidden
        />
        <div aria-hidden className="relative h-1/4 w-5/6 rounded-lg border-4 border-card" />
      </div>

      <footer className="flex flex-col gap-3 px-4 pb-5 pt-4 text-center">
        {error ? (
          <p role="alert" className="text-base">
            {error}
          </p>
        ) : (
          <p className="text-lg">{ready ? hint : 'Đang mở camera…'}</p>
        )}
        <div className="flex justify-center gap-6">
          {torch !== null ? (
            <button
              type="button"
              className="min-h-pda-touch text-base underline"
              onClick={() => void toggleTorch()}
            >
              {torch ? 'Tắt đèn' : 'Bật đèn'}
            </button>
          ) : null}
          <button type="button" className="min-h-pda-touch text-base underline" onClick={onClose}>
            Nhập tay
          </button>
        </div>
      </footer>
    </div>
  );
}
