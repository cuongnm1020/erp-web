import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCsv, toCsv } from './export-csv';

describe('toCsv', () => {
  it('bọc ô có dấu phẩy / ngoặc kép / xuống dòng; null → ô trống', () => {
    expect(
      toCsv(
        ['Mã', 'Tên'],
        [
          ['A1', 'Phân bón, NPK "16-16-8"'],
          [null, 'x\ny'],
        ],
      ),
    ).toBe('Mã,Tên\r\nA1,"Phân bón, NPK ""16-16-8"""\r\n,"x\ny"');
  });
});

describe('downloadCsv', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Blob mở đầu bằng BOM UTF-8, tên file có đuôi .csv', () => {
    const parts: unknown[][] = [];
    class BlobStub {
      constructor(p: unknown[]) {
        parts.push(p);
      }
    }
    vi.stubGlobal('Blob', BlobStub);
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    downloadCsv('bao-cao', ['A'], [[1]]);
    expect(parts[0]![0]).toBe('\uFEFF');
    expect(parts[0]![1]).toBe('A\r\n1');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});
