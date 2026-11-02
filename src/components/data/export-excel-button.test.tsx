import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportDeliveryContextProvider, type ExportFile } from './export-delivery';
import { collectExportRows, EXPORT_PAGE_SIZE, ExportExcelButton } from './export-excel-button';

/** Tên file đã lưu + nội dung sheet (jsdom không tải file được). */
const download = vi.fn();
let lastSheet: unknown;
vi.mock('@/lib/xlsx-writer', async (orig) => ({
  ...(await orig<typeof import('@/lib/xlsx-writer')>()),
  xlsxBlob: (sheet: unknown) => {
    lastSheet = sheet;
    return new Blob(['x']);
  },
  saveBlob: (_b: Blob, name: string) => download(name, lastSheet),
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
    expect(name).toMatch(/^don-hang_\d{4}-\d{2}-\d{2}\.xlsx$/);
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

  it('không có quyền xuất trực tiếp → giao file cho luồng email chờ duyệt, không tải về', async () => {
    const deliverFile = vi.fn(async (_f: ExportFile) => 'requested' as const);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ExportDeliveryContextProvider
          value={{ canDirect: false, deliverFile, deliverServer: vi.fn() }}
        >
          <ExportExcelButton
            fileName="khach-hang"
            title="Khách hàng"
            filters={{ q: 'Lan' }}
            columns={[{ header: 'Tên', value: (r: Row) => r.name }]}
            rows={make(1, 3)}
          />
        </ExportDeliveryContextProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }));
    await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(1));
    expect(deliverFile.mock.calls[0]![0]).toMatchObject({
      resource: 'khach-hang',
      title: 'Khách hàng',
      rowCount: 3,
      filters: { q: 'Lan' },
    });
    expect(deliverFile.mock.calls[0]![0].fileName).toMatch(/^khach-hang_.*\.xlsx$/);
    expect(download).not.toHaveBeenCalled();
  });
});
