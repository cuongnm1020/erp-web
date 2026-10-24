'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Quét mã vạch bằng camera điện thoại (2026-10-24, kiện hoàn về) — dùng `BarcodeDetector` có sẵn
 * của trình duyệt (Chrome Android), không thêm thư viện. Trình duyệt không có API này (Safari iPhone,
 * Firefox) → {@link isCameraScanSupported} false, màn gọi chỉ để nhập tay. Không biết gì về nghiệp
 * vụ (luật 12): đọc được một mã thì rung, gọi `onDetect` rồi để màn gọi đóng.
 */

/** Phần `BarcodeDetector` dùng tới — lib.dom của TypeScript chưa khai báo. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** Mã trên tem vận đơn / bao bì: CODE128 (vận đơn, phiếu), QR, EAN, CODE39. */
const WANTED_FORMATS = ['code_128', 'qr_code', 'ean_13', 'ean_8', 'code_39', 'itf'];
const SCAN_INTERVAL_MS = 200;

function detectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

/** Có camera + `BarcodeDetector` + ngữ cảnh an toàn (HTTPS / localhost). Chỉ gọi phía client. */
export function isCameraScanSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    detectorCtor() !== null
  );
}

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
  const [torch, setTorch] = useState<boolean | null>(null);
  const detectRef = useRef(onDetect);
  detectRef.current = onDetect;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;

    const start = async () => {
      const Ctor = detectorCtor();
      if (!Ctor) {
        setError('Trình duyệt này không quét được bằng camera — gõ mã bằng tay.');
        return;
      }
      try {
        const supported = (await Ctor.getSupportedFormats?.()) ?? WANTED_FORMATS;
        const formats = WANTED_FORMATS.filter((f) => supported.includes(f));
        const detector = new Ctor(formats.length ? { formats } : undefined);
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

        const tick = async () => {
          if (cancelled || done.current) return;
          try {
            const found = await detector.detect(el);
            const code = found.map((b) => b.rawValue.trim()).find((v) => v.length > 0);
            if (code && !done.current) {
              done.current = true;
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
        const denied = err instanceof DOMException && err.name === 'NotAllowedError';
        setError(
          denied
            ? 'Chưa cho phép dùng camera — bật quyền camera cho trang này trong cài đặt trình duyệt.'
            : 'Không mở được camera — gõ mã bằng tay.',
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
          <p className="text-lg">{hint}</p>
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
