import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectExportRows, EXPORT_PAGE_SIZE, ExportExcelButton } from './export-excel-button';

const download = vi.fn();
vi.mock('@/lib/xlsx-writer', async (orig) => ({
  ...(await orig<typeof import('@/lib/xlsx-writer')>()),
  downloadXlsx: (...a: unknown[]) => download(...a),
}));

interface Row {
  id: number;
  name: string;
}
const make = (from: number, n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: from + i, name: `R${from + i}` }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => download.mockClear());

describe('collectExportRows', () => {
  it('lặp trang cỡ 200 tới đủ total', async () => {
    const fetchPage = vi.fn(async (page: number, size: number) => ({
      items: make((page - 1) * size, Math.min(size, 450 - (page - 1) * size)),
      total: 450,
    }));
    const got = await collectExportRows(fetchPage);
    expect(fetchPage.mock.calls).toEqual([
      [1, EXPORT_PAGE_SIZE],
      [2, EXPORT_PAGE_SIZE],
      [3, EXPORT_PAGE_SIZE],
    ]);
    expect(got.rows).toHaveLength(450);
    expect(got.truncated).toBe(false);
  });

  it('chạm trần → cắt + truncated', async () => {
    const fetchPage = vi.fn(async (page: number, size: number) => ({
      items: make((page - 1) * size, size),
      total: 1000,
    }));
    const got = await collectExportRows(fetchPage, 300);
    expect(got.rows).toHaveLength(300);
    expect(got.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});

describe('<ExportExcelButton>', () => {
  it('bấm → kéo hết trang, ghi STT + cột, tải file .xlsx', async () => {
    const fetchPage = vi.fn(async () => ({ items: make(1, 2), total: 2 }));
    wrap(
      <ExportExcelButton
        fileName="don-hang"
        columns={[{ header: 'Tên', value: (r: Row) => r.name }]}
        fetchPage={fetchPage}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [name, sheet] = download.mock.calls[0]!;
    expect(name).toMatch(/^don-hang_\d{4}-\d{2}-\d{2}$/);
    expect(sheet).toMatchObject({
      header: ['STT', 'Tên'],
      rows: [
        [1, 'R1'],
        [2, 'R2'],
      ],
    });
  });

  it('nguồn rows (bảng không phân trang) → không gọi API', async () => {
    wrap(
      <ExportExcelButton
        fileName="x"
        columns={[{ header: 'Mã', value: (r: Row) => r.id }]}
        rows={make(5, 1)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(download.mock.calls[0]![1]).toMatchObject({ rows: [[1, 5]] });
  });
});
