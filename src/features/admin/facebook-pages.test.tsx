import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { FacebookPagesScreen } from './components/facebook-pages-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/facebook-pages',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const toastSuccess = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: vi.fn() },
}));

const ME_ADMIN_PAGES = { ...ME_SALE, permissions: ['facebook_page.manage', 'sales_order.read'] };

const page = (over: Record<string, unknown>) => ({
  externalId: null,
  sourceName: null,
  note: null,
  origin: 'PANCAKE',
  isActive: true,
  shopIds: [],
  orderCount: 0,
  lastOrderAt: null,
  version: 1,
  createdAt: '2026-09-03T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
  ...over,
});

/** Đúng shape `FacebookPageListResponseDto`. */
const LIST = {
  items: [
    page({
      id: 'p-1',
      name: 'Đất Phương Nam - CS4',
      externalId: '423097117553962',
      sourceName: 'Đất Phương Nam - TNNV - CS4',
      shopIds: ['715130909', '407957969', '111'],
      orderCount: 4912,
      lastOrderAt: new Date().toISOString(),
    }),
    page({
      id: 'p-2',
      name: 'ARI SYN Việt Nam - Giải Pháp Xanh Cs8',
      origin: 'MANUAL',
    }),
    page({
      id: 'p-3',
      name: 'Vật Tư Nông Nghiệp CS3',
      externalId: '594026677118889',
      shopIds: ['715130909'],
      orderCount: 1,
      lastOrderAt: '2026-09-03T00:00:00Z',
      isActive: false,
    }),
  ],
  total: 3,
};

describe('FacebookPagesScreen — Quản trị › Page Facebook (2026-10-26)', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    server.use(http.get('/api/facebook-pages', () => HttpResponse.json(LIST)));
  });

  it('bảng: tên + Page ID, POS theo tên (2 + "+1"), số đơn, đơn gần nhất cũ tô vàng, cách thêm, trạng thái', async () => {
    renderApp(<FacebookPagesScreen />, { me: ME_ADMIN_PAGES });
    const row = (await screen.findByText('Đất Phương Nam - CS4')).closest('tr')!;
    expect(within(row).getByText('423097117553962')).toBeInTheDocument();
    expect(within(row).getByText('Thiên Nông chính')).toBeInTheDocument();
    expect(within(row).getByText('POS 407957969 (đã ngắt)')).toBeInTheDocument();
    expect(within(row).getByText('+1')).toBeInTheDocument();
    expect(within(row).getByText('4.912')).toBeInTheDocument();
    expect(within(row).getByText('Tự động')).toBeInTheDocument();

    const manual = screen.getByText('ARI SYN Việt Nam - Giải Pháp Xanh Cs8').closest('tr')!;
    expect(within(manual).getByText('Chưa có Page ID')).toBeInTheDocument();
    expect(within(manual).getByText('Chưa gắn POS')).toBeInTheDocument();
    expect(within(manual).getByText('Chưa có đơn')).toBeInTheDocument();
    expect(within(manual).getByText('Thêm tay')).toBeInTheDocument();

    const stale = screen.getByText('Vật Tư Nông Nghiệp CS3').closest('tr')!;
    expect(within(stale).getByText('03/09/2026')).toHaveClass('text-warning');
    expect(within(stale).getByText('Ngưng')).toBeInTheDocument();
    expect(screen.getByText(/3 page/)).toBeInTheDocument();
  });

  it('Thêm page: tên + Page ID + POS (chọn nhiều) → POST đúng body; Page ID sai định dạng báo cạnh ô', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/facebook-pages', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(page({ id: 'p-new', name: 'Page mới', origin: 'MANUAL' }), {
          status: 201,
        });
      }),
    );
    renderApp(<FacebookPagesScreen />, { me: ME_ADMIN_PAGES });
    fireEvent.click(await screen.findByRole('button', { name: /Thêm page/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tên page *'), {
      target: { value: '  Page mới  ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Page ID Facebook'), {
      target: { value: 'abc' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm page' }));
    expect(await within(dialog).findByText('Page ID là dãy số (5–25 chữ số)')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Page ID Facebook'), {
      target: { value: '1234567890' },
    });
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'POS' }));
    fireEvent.click(await screen.findByRole('option', { name: /Thiên Nông chính/ }));
    expect(within(dialog).getByRole('list', { name: 'POS đã chọn' })).toHaveTextContent(
      'Thiên Nông chính',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm page' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      name: 'Page mới',
      externalId: '1234567890',
      shopIds: ['715130909'],
      note: null,
      isActive: true,
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã thêm page'));
  });

  it('Sửa page tự thêm từ Pancake: Page ID khoá, PATCH mang version, không gửi externalId', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/facebook-pages/p-1', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(LIST.items[0]);
      }),
    );
    renderApp(<FacebookPagesScreen />, { me: ME_ADMIN_PAGES });
    const row = (await screen.findByText('Đất Phương Nam - CS4')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /Sửa/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Page ID Facebook')).toBeDisabled();
    expect(
      within(dialog).getByText(/Tên Pancake gửi về: "Đất Phương Nam - TNNV - CS4"/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      version: 1,
      name: 'Đất Phương Nam - CS4',
      shopIds: ['715130909', '407957969', '111'],
      note: null,
      isActive: false,
    });
  });

  it('không có facebook_page.manage → không có nút Thêm page, không có thao tác dòng', async () => {
    renderApp(<FacebookPagesScreen />, { me: { ...ME_SALE, permissions: ['sales_order.read'] } });
    await screen.findByText('Đất Phương Nam - CS4');
    expect(screen.queryByRole('button', { name: /Thêm page/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa/ })).not.toBeInTheDocument();
  });
});
