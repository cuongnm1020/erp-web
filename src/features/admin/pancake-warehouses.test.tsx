import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorEnvelope, ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PancakeWarehouseSection } from './components/pancake-warehouse-section';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Toast không render trong harness → mock để khẳng định câu lỗi đi qua bộ dịch (luật 6).
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/pancake',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

describe('Kho trên Pancake — FE-PANCAKE-WH-1', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('bảng theo shop: kho đã nối, chưa có, đã bị xóa trên Pancake; kho Pancake chưa nối', async () => {
    renderApp(<PancakeWarehouseSection />);
    expect(await screen.findByText('Shop chính · 407957969')).toBeInTheDocument();
    expect(screen.getAllByText('Kho Thạch Thất')).toHaveLength(2);
    expect(screen.getByText('Chưa có — bấm Đẩy kho lên Pancake')).toBeInTheDocument();
    expect(screen.getByText('Đã bị xóa trên Pancake')).toBeInTheDocument();
    expect(screen.getByText(/Kho chỉ có trên Pancake/)).toHaveTextContent('Vật Tư Nông Nghiệp');
  });

  it('không có sync.config → không hiện mục, không gọi API (luật 7)', async () => {
    let called = false;
    server.use(
      http.get('/api/pancake-sync/warehouses/links', () => {
        called = true;
        return HttpResponse.json({ shops: [] });
      }),
    );
    renderApp(<PancakeWarehouseSection />, { me: { ...ME_SALE, permissions: ['sync.read'] } });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Kho trên Pancake')).not.toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('empty: chưa có shop đang bật', async () => {
    server.use(
      http.get('/api/pancake-sync/warehouses/links', () => HttpResponse.json({ shops: [] })),
    );
    renderApp(<PancakeWarehouseSection />);
    expect(await screen.findByText('Chưa có shop Pancake nào đang bật')).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId', async () => {
    server.use(
      http.get('/api/pancake-sync/warehouses/links', () => errorEnvelope(500, 'DB_ERROR')),
    );
    renderApp(<PancakeWarehouseSection />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });

  it('shop không đọc được kho → cảnh báo, không hiện lời Pancake thô (luật 6)', async () => {
    server.use(
      http.get('/api/pancake-sync/warehouses/links', () =>
        HttpResponse.json({
          shops: [
            {
              shopId: '407957969',
              shopName: 'Shop chính',
              error: 'Pancake HTTP 401: api_key invalid',
              warehouses: [],
              unlinked: [],
            },
          ],
        }),
      ),
    );
    renderApp(<PancakeWarehouseSection />);
    expect(await screen.findByText(/Không đọc được kho của shop/)).toBeInTheDocument();
    expect(screen.queryByText(/api_key invalid/)).not.toBeInTheDocument();
  });

  it('Đẩy kho lên Pancake → toast thành công kèm số kho', async () => {
    renderApp(<PancakeWarehouseSection />);
    await screen.findByText('Shop chính · 407957969');
    fireEvent.click(screen.getByRole('button', { name: 'Đẩy kho lên Pancake' }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã đẩy kho lên Pancake', {
        description: '2 kho ERP · mọi shop đang bật',
      }),
    );
  });

  it('Nối kho có sẵn: chọn kho Pancake → PUT đúng shop + kho → toast Đã nối kho', async () => {
    let body: unknown = null;
    let path = '';
    server.use(
      http.put('/api/pancake-sync/warehouses/:id/link', async ({ params, request }) => {
        body = await request.json();
        path = String(params.id);
        return HttpResponse.json({
          shopId: '407957969',
          entity: 'warehouse',
          internalId: String(params.id),
          action: 'updated',
          externalId: 'wh-pos-vtnn',
          reason: null,
        });
      }),
    );
    renderApp(<PancakeWarehouseSection />);
    await screen.findByText('Shop chính · 407957969');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Nối kho KHO-LA-01 với kho có sẵn trên shop 407957969',
      }),
    );
    const submit = await screen.findByRole('button', { name: 'Nối kho' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Vật Tư Nông Nghiệp/ }));
    fireEvent.click(submit);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess.mock.calls[0]?.[0]).toBe('Đã nối kho');
    expect(path).toBe('00000077-0000-4000-8000-000000000002');
    expect(body).toEqual({ shopId: '407957969', externalId: 'wh-pos-vtnn' });
  });

  it('kho Pancake đã nối kho ERP khác → 409 dịch qua bảng mã', async () => {
    server.use(
      http.put('/api/pancake-sync/warehouses/:id/link', () =>
        errorEnvelope(409, 'PANCAKE_WAREHOUSE_LINK_TAKEN'),
      ),
    );
    renderApp(<PancakeWarehouseSection />);
    await screen.findByText('Shop chính · 407957969');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Nối kho KHO-LA-01 với kho có sẵn trên shop 407957969',
      }),
    );
    fireEvent.click(await screen.findByRole('radio', { name: /Vật Tư Nông Nghiệp/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Nối kho' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith(
      'Kho trên Pancake này đã nối với một kho ERP khác. Gỡ liên kết của kho đó trước rồi nối lại.',
    );
  });

  it('Gỡ liên kết: xác nhận → DELETE kèm shopId', async () => {
    let url = '';
    server.use(
      http.delete('/api/pancake-sync/warehouses/:id/link', ({ request }) => {
        url = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<PancakeWarehouseSection />);
    await screen.findByText('Shop chính · 407957969');
    fireEvent.click(
      screen.getByRole('button', { name: 'Gỡ liên kết kho KHO-TT-01 trên shop 407957969' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Gỡ liên kết' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã gỡ liên kết'));
    expect(url).toContain('/pancake-sync/warehouses/00000077-0000-4000-8000-000000000001/link');
    expect(url).toContain('shopId=407957969');
  });
});
