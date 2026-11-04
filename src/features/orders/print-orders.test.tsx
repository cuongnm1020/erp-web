import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PrintOrdersScreen } from './components/print-orders-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/print-orders',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('group=all'),
}));

const FIRST = makeOrders(1)[0]!;

describe('PrintOrdersScreen — In đơn (clone màn Đơn hàng, 2026-11-04)', () => {
  it('tiêu đề + breadcrumb Kho › In đơn, bảng dữ liệu GET /sales-orders', async () => {
    renderApp(<PrintOrdersScreen />);
    expect(screen.getByRole('heading', { name: 'In đơn' })).toBeInTheDocument();
    expect(await screen.findByText(FIRST.docNumber)).toBeInTheDocument();
    expect(screen.getByTestId('order-count')).toHaveTextContent('60');
  });

  it('ẩn cột lưu vào tuỳ chọn riêng orders.print, không đụng orders.list của màn Đơn hàng', async () => {
    const keys: string[] = [];
    server.use(
      http.put('/api/me/preferences/:key', async ({ params, request }) => {
        keys.push(String(params.key));
        const body = (await request.json()) as { value: unknown };
        return HttpResponse.json({ key: params.key, value: body.value });
      }),
    );
    renderApp(<PrintOrdersScreen />);
    await screen.findByText(FIRST.docNumber);
    fireEvent.click(screen.getByRole('button', { name: /^Cột/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Sản phẩm' }));
    await waitFor(() => expect(keys).toEqual(['orders.print']));
  });
});
