import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { RouteAbilityGate } from './components/route-ability-gate';
import { SessionProvider } from './components/session-provider';

let pathname = '/catalog/products';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const gated = (
  <SessionProvider>
    <RouteAbilityGate>
      <div>NỘI DUNG TRANG</div>
    </RouteAbilityGate>
  </SessionProvider>
);

describe('<RouteAbilityGate> — URL trực tiếp vào route không có quyền', () => {
  it('sale không có product.read mở /catalog/products → màn không có quyền, không render trang', async () => {
    server.use(scenario.meSale);
    pathname = '/catalog/products';
    renderApp(gated);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
    expect(screen.queryByText('NỘI DUNG TRANG')).not.toBeInTheDocument();
  });

  it('sale mở đúng trang của mình (/crm/customers) → render bình thường', async () => {
    server.use(scenario.meSale);
    pathname = '/crm/customers';
    renderApp(gated);
    expect(await screen.findByText('NỘI DUNG TRANG')).toBeInTheDocument();
  });

  it('admin (hasGlobalAccess) mở mọi route → render bình thường', async () => {
    pathname = '/catalog/products'; // handler mặc định trả ME_ADMIN
    renderApp(gated);
    expect(await screen.findByText('NỘI DUNG TRANG')).toBeInTheDocument();
  });

  it('route không gate (/pricing/promotions) → render không cần chờ quyền', async () => {
    server.use(scenario.meSale);
    pathname = '/pricing/promotions';
    renderApp(gated);
    expect(await screen.findByText('NỘI DUNG TRANG')).toBeInTheDocument();
  });
});
