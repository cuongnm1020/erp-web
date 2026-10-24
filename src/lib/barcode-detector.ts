/**
 * Bộ đọc mã vạch cho camera (2026-10-24). Trình duyệt có `BarcodeDetector` đọc được CODE128
 * (Chrome Android, Chrome macOS) → dùng bản có sẵn. Không có (mọi trình duyệt trên iPhone — đều là
 * WebKit; Firefox; Chrome Windows) → nạp ponyfill `barcode-detector` (ZXing biên dịch WebAssembly)
 * lúc mở camera lần đầu, không vào bundle chính.
 *
 * File `.wasm` tự phục vụ ở `/vendor/zxing-<phiên bản>/` (không tải từ CDN ngoài). Nâng
 * `barcode-detector` → chép lại `zxing_reader.wasm` đúng phiên bản; `barcode-detector.test.ts` so
 * mã băm SHA-256 với bản thư viện công bố và fail khi lệch.
 */

export interface DetectedBarcode {
  rawValue: string;
}
export interface BarcodeReader {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeReader;
  getSupportedFormats?: () => Promise<string[]>;
}

/** Mã trên tem vận đơn / bao bì: CODE128 (vận đơn, phiếu), QR, EAN, CODE39, ITF. */
export const WANTED_FORMATS = ['code_128', 'qr_code', 'ean_13', 'ean_8', 'code_39', 'itf'];

/** Thư mục chứa `.wasm` trong `public/` — theo phiên bản để trình duyệt không giữ bản cũ. */
export const zxingWasmDir = (version: string) => `/vendor/zxing-${version}/`;

function nativeCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

/** Có camera + ngữ cảnh an toàn (HTTPS / localhost) + WebAssembly. Chỉ gọi phía client. */
export function isCameraScanSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    (nativeCtor() !== null || typeof WebAssembly !== 'undefined')
  );
}

let ponyfill: Promise<BarcodeDetectorCtor> | null = null;

async function loadPonyfill(): Promise<BarcodeDetectorCtor> {
  ponyfill ??= import('barcode-detector/ponyfill').then((m) => {
    const dir = zxingWasmDir(m.ZXING_WASM_VERSION);
    m.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? `${dir}${path}` : prefix + path,
      },
    });
    return m.BarcodeDetector as unknown as BarcodeDetectorCtor;
  });
  return ponyfill;
}

/** Tạo bộ đọc: bản có sẵn nếu đọc được CODE128, không thì ponyfill ZXing. */
export async function createBarcodeReader(): Promise<BarcodeReader> {
  const native = nativeCtor();
  if (native) {
    const supported = (await native.getSupportedFormats?.().catch(() => [])) ?? [];
    if (supported.includes('code_128')) {
      return new native({ formats: WANTED_FORMATS.filter((f) => supported.includes(f)) });
    }
  }
  const Ctor = await loadPonyfill();
  return new Ctor({ formats: WANTED_FORMATS });
}
