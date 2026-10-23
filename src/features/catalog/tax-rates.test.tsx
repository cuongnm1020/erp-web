import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { TaxRatesScreen } from './components/tax-rates-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/catalog/tax-rates',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const toastSuccess = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: vi.fn() },
}));

const rate = (over: Record<string, unknown>) => ({
  kind: 'TAXABLE',
  validFrom: null,
  validTo: null,
  replacementId: null,
  isDefault: false,
  isActive: true,
  productCount: 0,
  usedByOrders: false,
  version: 0,
  createdAt: '2026-10-23T00:00:00Z',
  updatedAt: '2026-10-23T00:00:00Z',
  ...over,
});

/** Đúng shape `TaxRateListResponseDto`. */
const LIST = {
  items: [
    rate({
      id: 'tr-5',
      code: 'VAT5',
      name: 'Thuế GTGT 5%',
      ratePercent: '5',
      misaName: '5%',
      isDefault: true,
      productCount: 212,
    }),
    rate({
      id: 'tr-8',
      code: 'VAT8',
      name: 'Thuế GTGT 8% (giảm từ 10%)',
      ratePercent: '8',
      misaName: '8%',
      validTo: '2026-12-31',
      productCount: 53,
      usedByOrders: true,
      version: 2,
    }),
    rate({
      id: 'tr-0',
      code: 'VAT0',
      name: 'Thuế GTGT 0%',
      ratePercent: '0',
      misaName: '0%',
      isActive: false,
    }),
  ],
  unassignedProductCount: 14,
};

const ME_ACCOUNTANT = { ...ME_SALE, permissions: ['tax_rate.manage', 'product.read'] };

let posts: unknown[] = [];
let patches: Array<{ id: string; body: unknown }> = [];

beforeEach(() => {
  posts = [];
  patches = [];
  toastSuccess.mockClear();
  server.use(
    http.get('/api/tax-rates', () => HttpResponse.json(LIST)),
    http.post('/api/tax-rates', async ({ request }) => {
      posts.push(await request.json());
      return HttpResponse.json(LIST.items[0], { status: 201 });
    }),
    http.patch('/api/tax-rates/:id', async ({ request, params }) => {
      patches.push({ id: String(params.id), body: await request.json() });
      return HttpResponse.json(LIST.items[1]);
    }),
  );
});

describe('TaxRatesScreen — danh mục thuế suất', () => {
  it('liệt kê mức đang dùng: mặc định, hiệu lực, số sản phẩm (link lọc), đếm chưa gán', async () => {
    renderApp(<TaxRatesScreen />, { me: ME_ACCOUNTANT });
    expect(await screen.findByText('Thuế GTGT 8% (giảm từ 10%)')).toBeInTheDocument();
    expect(screen.getByText('Mặc định')).toBeInTheDocument();
    expect(screen.getByText('đến 31/12/2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '53' })).toHaveAttribute(
      'href',
      '/catalog/products?taxRate=tr-8',
    );
    expect(screen.getByRole('link', { name: '14 sản phẩm chưa gán' })).toHaveAttribute(
      'href',
      '/catalog/products?taxRate=none',
    );
    // Mức ngừng dùng chỉ hiện ở "Tất cả".
    expect(screen.queryByText('Thuế GTGT 0%')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(screen.getByText('Thuế GTGT 0%')).toBeInTheDocument();
    expect(screen.getByText('Ngừng dùng')).toBeInTheDocument();
  });

  it('thêm thuế suất: POST % dạng chuỗi, ngày trống = null', async () => {
    renderApp(<TaxRatesScreen />, { me: ME_ACCOUNTANT });
    await screen.findByText('Thuế GTGT 5%');
    fireEvent.click(screen.getByRole('button', { name: /Thêm thuế suất/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tên *'), {
      target: { value: 'Thuế GTGT 3,5%' },
    });
    fireEvent.change(within(dialog).getByLabelText('Mã *'), { target: { value: 'vat3' } });
    fireEvent.change(within(dialog).getByLabelText('Thuế suất (%) *'), {
      target: { value: '3,5' },
    });
    expect(within(dialog).getByDisplayValue('3.5%')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm thuế suất' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      code: 'VAT3',
      name: 'Thuế GTGT 3,5%',
      kind: 'TAXABLE',
      ratePercent: '3.5',
      isDefault: false,
      validFrom: null,
      validTo: null,
      replacementId: null,
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã thêm thuế suất'));
  });

  it('sửa mức đã có đơn dùng: ô % khóa kèm lý do, PATCH không gửi kind / ratePercent', async () => {
    renderApp(<TaxRatesScreen />, { me: ME_ACCOUNTANT });
    await screen.findByText('Thuế GTGT 8% (giảm từ 10%)');
    const row = screen.getByText('Thuế GTGT 8% (giảm từ 10%)').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /Sửa/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Thuế suất (%) *')).toBeDisabled();
    expect(within(dialog).getByText(/Đã có đơn hàng dùng mức này/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Tên *'), {
      target: { value: 'Thuế GTGT 8%' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]!.id).toBe('tr-8');
    expect(patches[0]!.body).toEqual({
      version: 2,
      code: 'VAT8',
      name: 'Thuế GTGT 8%',
      validFrom: null,
      validTo: '2026-12-31',
      replacementId: null,
    });
  });

  it('không có tax_rate.manage → chỉ xem, không có nút thêm / sửa', async () => {
    renderApp(<TaxRatesScreen />, { me: { ...ME_SALE, permissions: ['product.read'] } });
    await screen.findByText('Thuế GTGT 5%');
    expect(screen.queryByRole('button', { name: /Thêm thuế suất/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa/ })).not.toBeInTheDocument();
  });
});
