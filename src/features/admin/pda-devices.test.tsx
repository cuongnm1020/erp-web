import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUsers } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PdaDevicesScreen } from './components/pda-devices-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/pda-devices',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const WH = {
  id: '00000000-0000-4000-8000-0000000a0001',
  code: 'WH01',
  name: 'Kho Hà Nội',
  address: null,
  contactName: null,
  phone: null,
};
const USERS = makeUsers(2);
const PM01 = {
  id: '00000000-0000-4000-8000-0000000e0001',
  code: 'PM84-01',
  serialNumber: '26023A0102',
  model: 'PM84',
  warehouseId: WH.id,
  boundUserId: USERS[0]!.id,
  boundUser: { id: USERS[0]!.id, code: USERS[0]!.code, fullName: USERS[0]!.fullName },
  status: 'ACTIVE',
  appVersion: '0.1.0',
  lastSeenAt: '2026-10-05T00:40:00.000Z',
  registeredAt: '2026-10-05T00:00:00.000Z',
};
const PM02 = {
  ...PM01,
  id: '00000000-0000-4000-8000-0000000e0002',
  code: 'PM84-02',
  serialNumber: 'SN-2',
  warehouseId: null,
  boundUserId: null,
  boundUser: null,
  status: 'MAINTENANCE',
  appVersion: null,
  lastSeenAt: null,
};

function wire(opts: { items?: unknown[]; postError?: unknown } = {}) {
  const deviceQueries: URLSearchParams[] = [];
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const items = opts.items ?? [PM01, PM02];
  server.use(
    http.get('/api/warehouses', () => HttpResponse.json([WH])),
    http.get('/api/users', () => HttpResponse.json({ items: USERS, total: USERS.length })),
    http.get('/api/devices', ({ request }) => {
      deviceQueries.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items, total: items.length });
    }),
    http.post('/api/devices', async ({ request }) => {
      calls.push({ method: 'POST', url: '/devices', body: await request.json() });
      if (opts.postError) return HttpResponse.json(opts.postError, { status: 409 });
      return HttpResponse.json({ ...PM02, id: 'new' }, { status: 201 });
    }),
    http.patch('/api/devices/:id', async ({ request, params }) => {
      calls.push({ method: 'PATCH', url: `/devices/${params.id}`, body: await request.json() });
      return HttpResponse.json(PM01);
    }),
    http.delete('/api/devices/:id', ({ params }) => {
      calls.push({ method: 'DELETE', url: `/devices/${params.id}`, body: null });
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('/api/devices/bulk-delete', async ({ request }) => {
      const body = (await request.json()) as { ids: string[] };
      calls.push({ method: 'POST', url: '/devices/bulk-delete', body });
      return HttpResponse.json({
        deleted: body.ids.map((id) => ({ id, code: id === PM01.id ? PM01.code : PM02.code })),
        skipped: [],
      });
    }),
  );
  return { deviceQueries, calls };
}

describe('PdaDevicesScreen — Thiết bị PDA', () => {
  beforeEach(() => {
    search = '';
    replace.mockClear();
  });

  it('bảng từ GET /devices: tên kho, nhân viên khóa, trạng thái; lọc gửi lên server', async () => {
    const { deviceQueries } = wire();
    search = 'status=ACTIVE&q=pm';
    renderApp(<PdaDevicesScreen />);
    expect(await screen.findByText('PM84-01')).toBeInTheDocument();
    expect(screen.getByText('2 thiết bị')).toBeInTheDocument();
    expect(await screen.findByText('WH01 · Kho Hà Nội')).toBeInTheDocument();
    expect(screen.getByText('Mọi kho')).toBeInTheDocument();
    expect(screen.getByText(USERS[0]!.fullName)).toBeInTheDocument();
    expect(screen.getByText('Ai cũng được')).toBeInTheDocument();
    expect(screen.getByText('Bảo trì')).toBeInTheDocument();
    const q = deviceQueries.at(-1)!;
    expect(q.get('status')).toBe('ACTIVE');
    expect(q.get('q')).toBe('pm');
    expect(q.get('take')).toBe('50');
  });

  it('trống: lời mời đăng ký thiết bị', async () => {
    wire({ items: [] });
    renderApp(<PdaDevicesScreen />);
    expect(await screen.findByText('Chưa đăng ký thiết bị nào')).toBeInTheDocument();
  });

  it('Đăng ký: POST /devices chỉ gửi trường có giá trị', async () => {
    const { calls } = wire();
    renderApp(<PdaDevicesScreen />);
    await screen.findByText('PM84-01');
    fireEvent.click(screen.getByRole('button', { name: /Đăng ký thiết bị/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Mã máy/), { target: { value: 'PM84-03' } });
    fireEvent.change(within(dialog).getByLabelText(/Serial/), {
      target: { value: ' 26023A0199 ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đăng ký thiết bị' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      method: 'POST',
      url: '/devices',
      body: { code: 'PM84-03', serialNumber: '26023A0199', status: 'ACTIVE' },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Đăng ký trùng serial → 409 báo ngay dưới ô Serial, dialog giữ nguyên', async () => {
    wire({
      postError: {
        statusCode: 409,
        code: 'UNIQUE_VIOLATION',
        message: 'Dữ liệu bị trùng',
        details: { modelName: 'Device', target: ['serialNumber'] },
      },
    });
    renderApp(<PdaDevicesScreen />);
    await screen.findByText('PM84-01');
    fireEvent.click(screen.getByRole('button', { name: /Đăng ký thiết bị/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Mã máy/), { target: { value: 'PM84-09' } });
    fireEvent.change(within(dialog).getByLabelText(/Serial/), { target: { value: '26023A0102' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đăng ký thiết bị' }));
    expect(
      await within(dialog).findByText('Serial này đã đăng ký cho máy khác'),
    ).toBeInTheDocument();
  });

  it('Sửa: prefill, đổi mã + bỏ kho/khóa nhân viên → PATCH gửi null', async () => {
    const { calls } = wire();
    renderApp(<PdaDevicesScreen />);
    await screen.findByText('PM84-01');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sửa' })[0]!);
    const dialog = await screen.findByRole('dialog');
    const code = within(dialog).getByLabelText(/Mã máy/);
    expect(code).toHaveValue('PM84-01');
    expect(within(dialog).getByLabelText(/Serial/)).toHaveValue('26023A0102');
    fireEvent.change(code, { target: { value: 'PM84-10' } });
    fireEvent.change(within(dialog).getByLabelText(/Tên \/ model/), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      method: 'PATCH',
      url: `/devices/${PM01.id}`,
      body: {
        code: 'PM84-10',
        serialNumber: '26023A0102',
        model: null,
        warehouseId: WH.id,
        boundUserId: USERS[0]!.id,
        status: 'ACTIVE',
      },
    });
  });

  it('Xóa một dòng qua hộp xác nhận → DELETE /devices/:id', async () => {
    const { calls } = wire();
    renderApp(<PdaDevicesScreen />);
    await screen.findByText('PM84-01');
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa' })[1]!);
    const confirm = await screen.findByRole('dialog');
    expect(within(confirm).getByText(/thiết bị PM84-02/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Xóa' }));
    await waitFor(() =>
      expect(calls).toEqual([{ method: 'DELETE', url: `/devices/${PM02.id}`, body: null }]),
    );
  });

  it('Xóa nhiều: chọn tất cả → "Xóa (2)" → POST /devices/bulk-delete', async () => {
    const { calls } = wire();
    renderApp(<PdaDevicesScreen />);
    await screen.findByText('PM84-01');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả dòng trong trang' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa (2)' }));
    const confirm = await screen.findByRole('dialog');
    expect(within(confirm).getByText('Xóa 2 thiết bị?')).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      method: 'POST',
      url: '/devices/bulk-delete',
      body: { ids: [PM01.id, PM02.id] },
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Xóa (2)' })).not.toBeInTheDocument(),
    );
  });
});
