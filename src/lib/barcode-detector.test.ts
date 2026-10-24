import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ZXING_WASM_SHA256, ZXING_WASM_VERSION } from 'barcode-detector/ponyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBarcodeReader, isCameraScanSupported, zxingWasmDir } from './barcode-detector';

type Win = { BarcodeDetector?: unknown };

afterEach(() => {
  delete (window as unknown as Win).BarcodeDetector;
  vi.unstubAllGlobals();
});

describe('bộ đọc mã vạch camera', () => {
  it('file zxing_reader.wasm tự phục vụ khớp đúng phiên bản + SHA-256 thư viện công bố', () => {
    const file = join(
      process.cwd(),
      'public',
      zxingWasmDir(ZXING_WASM_VERSION),
      'zxing_reader.wasm',
    );
    expect(existsSync(file)).toBe(true);
    const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
    expect(sha).toBe(ZXING_WASM_SHA256);
  });

  it('trình duyệt có BarcodeDetector đọc được CODE128 → dùng bản có sẵn với các định dạng nó hỗ trợ', async () => {
    const made: unknown[] = [];
    class Native {
      static getSupportedFormats = async () => ['code_128', 'qr_code', 'aztec'];
      constructor(opts: unknown) {
        made.push(opts);
      }
      detect = async () => [];
    }
    (window as unknown as Win).BarcodeDetector = Native;
    const reader = await createBarcodeReader();
    expect(reader).toBeInstanceOf(Native);
    expect(made).toEqual([{ formats: ['code_128', 'qr_code'] }]);
  });

  it('không có camera / không HTTPS → không hiện nút camera', () => {
    vi.stubGlobal('isSecureContext', false);
    expect(isCameraScanSupported()).toBe(false);
  });
});
