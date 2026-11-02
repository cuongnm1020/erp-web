import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportDelivery, type ExportOutcome } from '@/components/data/export-delivery';
import { ME_ADMIN, ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { clickRowMenuItem } from '@/test/row-menu';
import { ExportDeliveryProvider } from './components/export-delivery-provider';
import { ExportRequestsScreen } from './components/export-requests-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const push = vi.fn();
const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/export-requests',
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const saved = vi.fn();
const opened = vi.fn();
vi.mock('@/lib/xlsx-writer', async (orig) => ({
  ...(await orig<typeof import('@/lib/xlsx-writer')>()),
  saveBlob: (_b: Blob, name: string) => saved(name),
  openDownload: (href: string) => opened(href),
}));

const ME_DIRECT = { ...ME_SALE, permissions: [...ME_SALE.permissions, 'export.direct'] };

const REQ = {
  id: '00000000-0000-4000-8000-00000000e001',
  requester: { id: 'u-sale', code: 'sale.hn.1', fullName: 'Trần Thị Hoa' },
  resource: 'orders',
  title: 'Đơn hàng',
  fileName: 'don-hang_2026-11-02.xlsx',
  fileSize: 20480,
  rowCount: 1250,
  email: 'hoa@gmail.com',
  filters: {},
  status: 'PENDING',
  reviewer: null,
  reviewedAt: null,
  rejectReason: null,
  sentAt: null,
  sendError: null,
  sendCount: 0,
  createdAt: '2026-11-02T03:00:00.000Z',
};

/** Nút giả một màn gọi luồng xuất. */
function Exporter({ onOutcome }: { onOutcome: (o: ExportOutcome) => void }) {
  const d = useExportDelivery();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void d
            .deliverFile({
              blob: new Blob(['PK-data']),
              fileName: 'khach-hang_2026-11-02.xlsx',
              resource: 'khach-hang',
              title: 'Khách hàng',
              rowCount: 40,
              filters: { q: 'Lan' },
            })
            .then(onOutcome)
        }
      >
        Xuất thử
      </button>
      <button
        type="button"
        onClick={() =>
          void d
            .deliverServer({
              href: '/api/stock/excel?warehouseId=w1',
              requestByEmail: (email) =>
                fetch(`/api/stock/excel?warehouseId=w1&email=${encodeURIComponent(email)}`).then(
                  (r) => r.json(),
                ),
              resource: 'stock-excel',
              title: 'Tồn kho',
            })
            .then(onOutcome)
        }
      >
        Xuất server
      </button>
    </>
  );
}

beforeEach(() => {
  search = '';
  saved.mockClear();
  opened.mockClear();
  push.mockClear();
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
});

describe('Luồng xuất Excel (provider)', () => {
  it('có export.direct: ghi nhật ký rồi tải ngay, không hỏi email', async () => {
    const logs: unknown[] = [];
    server.use(
      http.post('/api/excel-logs', async ({ request }) => {
        logs.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onOutcome = vi.fn();
    renderApp(
      <ExportDeliveryProvider>
        <Exporter onOutcome={onOutcome} />
      </ExportDeliveryProvider>,
      { me: ME_DIRECT },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xuất thử' }));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('downloaded'));
    expect(saved).toHaveBeenCalledWith('khach-hang_2026-11-02.xlsx');
    expect(logs[0]).toMatchObject({
      resource: 'khach-hang',
      title: 'Khách hàng',
      rowCount: 40,
      fileName: 'khach-hang_2026-11-02.xlsx',
      filters: JSON.stringify({ q: 'Lan' }),
    });
    expect(screen.queryByText('Gửi file Excel qua email')).toBeNull();
  });

  it('có export.direct nhưng ghi nhật ký lỗi → không tải file', async () => {
    server.use(
      http.post('/api/excel-logs', () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 }),
      ),
    );
    const onOutcome = vi.fn();
    renderApp(
      <ExportDeliveryProvider>
        <Exporter onOutcome={onOutcome} />
      </ExportDeliveryProvider>,
      { me: ME_DIRECT },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xuất thử' }));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('cancelled'));
    expect(saved).not.toHaveBeenCalled();
  });

  it('không có quyền: hỏi email (bắt hợp lệ), gửi file + email lên chờ duyệt, nhớ email', async () => {
    const uploads: Array<Record<string, unknown>> = [];
    server.use(
      http.post('/api/export-requests', async ({ request }) => {
        const fd = await request.formData();
        uploads.push({
          email: fd.get('email'),
          resource: fd.get('resource'),
          title: fd.get('title'),
          rowCount: fd.get('rowCount'),
          filters: fd.get('filters'),
          // jsdom + MSW không giữ nội dung / tên File qua FormData — chỉ kiểm có field file.
          hasFile: fd.has('file'),
        });
        return HttpResponse.json({ ...REQ, email: String(fd.get('email')) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const onOutcome = vi.fn();
    renderApp(
      <ExportDeliveryProvider>
        <Exporter onOutcome={onOutcome} />
      </ExportDeliveryProvider>,
      { me: ME_SALE },
    );
    await user.click(screen.getByRole('button', { name: 'Xuất thử' }));
    expect(await screen.findByText('Gửi file Excel qua email')).toBeInTheDocument();
    expect(screen.getByText(/Khách hàng · 40 dòng/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText('Nhập email nhận file')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Email nhận file/), 'khong-hop-le');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText('Email không hợp lệ')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Email nhận file/));
    await user.type(screen.getByLabelText(/Email nhận file/), 'lan@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('requested'));
    expect(uploads[0]).toEqual({
      email: 'lan@gmail.com',
      resource: 'khach-hang',
      title: 'Khách hàng',
      rowCount: '40',
      filters: JSON.stringify({ q: 'Lan' }),
      hasFile: true,
    });
    expect(saved).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('erp.exportEmail')).toBe('lan@gmail.com');
  });

  it('không có quyền, file do server tạo: gọi route kèm ?email=; Hủy = không gửi', async () => {
    const urls: string[] = [];
    server.use(
      http.get('/api/stock/excel', ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(REQ, { status: 202 });
      }),
    );
    window.localStorage.setItem('erp.exportEmail', 'kho@gmail.com');
    const user = userEvent.setup();
    const onOutcome = vi.fn();
    renderApp(
      <ExportDeliveryProvider>
        <Exporter onOutcome={onOutcome} />
      </ExportDeliveryProvider>,
      { me: ME_SALE },
    );
    await user.click(screen.getByRole('button', { name: 'Xuất server' }));
    await user.click(await screen.findByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('cancelled'));
    expect(urls).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Xuất server' }));
    // Email lần trước điền sẵn.
    expect(await screen.findByDisplayValue('kho@gmail.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => expect(onOutcome).toHaveBeenLastCalledWith('requested'));
    expect(new URL(urls[0]!).searchParams.get('email')).toBe('kho@gmail.com');
    expect(opened).not.toHaveBeenCalled();
  });
});

describe('Màn Duyệt xuất Excel', () => {
  function wire(items: unknown[] = [REQ]) {
    const calls: Array<{ url: string; body: unknown }> = [];
    const listQueries: URLSearchParams[] = [];
    server.use(
      http.get('/api/export-requests/pending-count', () =>
        HttpResponse.json({ count: 1, mailConfigured: false }),
      ),
      http.get('/api/export-requests', ({ request }) => {
        listQueries.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items, total: items.length });
      }),
      http.post('/api/export-requests/:id/approve', ({ params }) => {
        calls.push({ url: `approve/${String(params.id)}`, body: null });
        return HttpResponse.json({ ...REQ, status: 'APPROVED' });
      }),
      http.post('/api/export-requests/:id/reject', async ({ request, params }) => {
        calls.push({ url: `reject/${String(params.id)}`, body: await request.json() });
        return HttpResponse.json({ ...REQ, status: 'REJECTED' });
      }),
      http.get('/api/excel-logs', ({ request }) => {
        listQueries.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          total: 1,
          items: [
            {
              id: '1',
              user: { id: 'u-sale', code: 'sale.hn.1', fullName: 'Trần Thị Hoa' },
              action: 'IMPORT',
              resource: 'suppliers',
              title: 'Nhà cung cấp',
              fileName: 'ncc.xlsx',
              fileSize: 2048,
              rowCount: null,
              email: null,
              requestId: null,
              detail: { ok: false },
              ip: '10.0.0.5',
              createdAt: '2026-11-02T03:00:00.000Z',
            },
          ],
        });
      }),
    );
    return { calls, listQueries };
  }

  it('tab Chờ duyệt: hiện yêu cầu, cảnh báo chưa cấu hình SMTP, duyệt gọi API', async () => {
    const { calls, listQueries } = wire();
    renderApp(<ExportRequestsScreen />, { me: ME_ADMIN });
    expect(await screen.findByText('Trần Thị Hoa')).toBeInTheDocument();
    expect(screen.getByText(/1\.250 dòng/)).toBeInTheDocument();
    expect(screen.getByText('hoa@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa cấu hình gửi email');
    expect(listQueries[0]!.get('status')).toBe('PENDING');
    fireEvent.click(screen.getByRole('button', { name: /Duyệt và gửi/ }));
    await waitFor(() => expect(calls).toEqual([{ url: `approve/${REQ.id}`, body: null }]));
  });

  it('từ chối bắt nhập lý do rồi gửi', async () => {
    const { calls } = wire();
    const user = userEvent.setup();
    renderApp(<ExportRequestsScreen />, { me: ME_ADMIN });
    await screen.findByText('Trần Thị Hoa');
    await clickRowMenuItem('Từ chối');
    const submit = await screen.findByRole('button', { name: 'Từ chối yêu cầu' });
    await user.click(submit);
    expect(await screen.findByText('Nhập lý do từ chối')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Lý do từ chối/), 'Không cần SĐT khách');
    await user.click(submit);
    await waitFor(() =>
      expect(calls).toEqual([{ url: `reject/${REQ.id}`, body: { reason: 'Không cần SĐT khách' } }]),
    );
  });

  it('tab Nhật ký: lần nhập lỗi hiện rõ, kèm IP', async () => {
    search = 'tab=logs';
    wire();
    renderApp(<ExportRequestsScreen />, { me: ME_ADMIN });
    expect(await screen.findByText('Nhập file (lỗi)')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
    expect(screen.getByText(/ncc\.xlsx/)).toBeInTheDocument();
  });

  it('Yêu cầu của tôi: chỉ xem, gọi mine=true, không có nút duyệt', async () => {
    const { listQueries } = wire([{ ...REQ, status: 'REJECTED', rejectReason: 'Không cần' }]);
    renderApp(<ExportRequestsScreen mine />, { me: ME_SALE });
    expect(await screen.findByText('Không cần')).toBeInTheDocument();
    expect(listQueries[0]!.get('mine')).toBe('true');
    expect(screen.queryByRole('button', { name: /Duyệt và gửi/ })).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});
