import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { CustomerWorkCard } from './components/customer-work-card';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers/k1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

describe('Thẻ yêu cầu ở hồ sơ khách', () => {
  it('liệt kê yêu cầu của khách + nút Tạo yêu cầu (CSKH)', async () => {
    server.use(
      http.get('/api/work-items', () =>
        HttpResponse.json({
          total: 1,
          items: [
            {
              id: 'w1',
              docNumber: 'YC2610-00042',
              kind: 'CUSTOMER',
              status: 'IN_PROGRESS',
              title: '2 chai thuốc bị rò rỉ',
              categoryName: 'Hàng hư / vỡ / rò rỉ',
              createdAt: '2026-10-22T01:47:00.000Z',
            },
          ],
        }),
      ),
    );
    renderApp(<CustomerWorkCard customerId="k1" />, {
      me: { permissions: ['work.read', 'work.create_customer'], hasGlobalAccess: false },
    });
    expect(await screen.findByText('YC2610-00042')).toBeInTheDocument();
    expect(screen.getByText('Đang xử lý')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tạo yêu cầu/ })).toHaveAttribute(
      'href',
      '/work/new?kind=CUSTOMER&customerId=k1',
    );
  });
});
