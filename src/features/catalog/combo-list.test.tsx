import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { ComboListScreen } from './components/combo-list-screen';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

let search = '';
const replace = vi.fn((url: string) => {
  const i = url.indexOf('?');
  search = i === -1 ? '' : url.slice(i + 1);
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/catalog/combos',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const uuid = (i: number) => `00000031-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** Đúng shape `ComboListItemDto`. */
const ROWS = [
  {
    id: uuid(1),
    skuId: uuid(11),
    code: 'CB-0001',
    name: 'Combo trừ sâu 2+1',
    isActive: true,
    baseUomCode: 'PCS',
    baseUomId: uuid(9),
    salePrice: '150000',
    componentCount: 2,
    quantity: '3',
    quantityUomCode: 'PCS',
    available: '50',
    version: 1,
    createdAt: '2026-09-18T00:00:00.000Z',
    updatedAt: '2026-09-18T00:00:00.000Z',
    createdById: uuid(901),
    createdByName: 'Trần Anh Tuấn',
  },
  {
    id: uuid(2),
    skuId: uuid(12),
    code: 'CB-0002',
    name: 'Combo hết hàng',
    isActive: false,
    baseUomCode: 'PCS',
    baseUomId: uuid(9),
    salePrice: null,
    componentCount: 3,
    quantity: '12',
    quantityUomCode: null,
    available: '0',
    version: 0,
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    createdById: null,
    createdByName: null,
  },
];

describe('ComboListScreen — GET /combos', () => {
  it('render dòng: mã dẫn tới màn sửa, số thành phần, giá, còn bán được, trạng thái', async () => {
    const queries: string[] = [];
    server.use(
      http.get('/api/combos', ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({ items: ROWS, total: 2 });
      }),
    );
    renderApp(<ComboListScreen />);
    expect(await screen.findByRole('link', { name: 'CB-0001' })).toHaveAttribute(
      'href',
      `/catalog/combos/${uuid(1)}/edit`,
    );
    expect(screen.getByText('Combo trừ sâu 2+1')).toBeInTheDocument();
    expect(screen.getByText('2 SKU')).toBeInTheDocument();
    expect(screen.getByText('Chưa đặt giá')).toBeInTheDocument();
    expect(screen.getByText('Đang bán')).toBeInTheDocument();
    expect(screen.getByText('Ngừng bán')).toBeInTheDocument();
    // Còn bán được = 0 → chữ đỏ
    expect(screen.getByText('0 PCS')).toHaveClass('text-destructive');
    // Cột Người tạo (2026-11-09): tên; không rõ → "—"
    expect(screen.getByRole('columnheader', { name: /Người tạo/ })).toBeInTheDocument();
    expect(screen.getByText('Combo trừ sâu 2+1').closest('tr')!).toHaveTextContent('Trần Anh Tuấn');
    expect(screen.getByText('Combo hết hàng').closest('tr')!).toHaveTextContent('—');
    expect(queries[0]).toContain('take=50');
  });

  it('cột Định mức (2026-11-06): Σ SL thành phần + ĐVT; bấm tiêu đề → GET /combos?sortBy=quantity', async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/combos', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: ROWS, total: 2 });
      }),
    );
    renderApp(<ComboListScreen />);
    await screen.findByRole('link', { name: 'CB-0001' });
    const row1 = screen.getByText('Combo trừ sâu 2+1').closest('tr')!;
    expect(row1).toHaveTextContent('3 PCS');
    // Thành phần khác ĐVT → chỉ số, không ĐVT.
    expect(screen.getByText('Combo hết hàng').closest('tr')!).toHaveTextContent('12');
    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp theo Định mức' }));
    await waitFor(() => expect(search).toContain('sort=quantity'));
  });

  it('empty state mời tạo combo đầu tiên (admin thấy nút Tạo combo)', async () => {
    server.use(http.get('/api/combos', () => HttpResponse.json({ items: [], total: 0 })));
    renderApp(<ComboListScreen />);
    expect(await screen.findByText('Chưa có combo nào')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Tạo combo/ }).length).toBeGreaterThan(0);
  });

  it('sale không có product.create → không thấy nút Tạo combo; lọc trạng thái ghi lên URL', async () => {
    server.use(http.get('/api/combos', () => HttpResponse.json({ items: ROWS, total: 2 })));
    renderApp(<ComboListScreen />, { me: ME_SALE });
    await screen.findByText('Combo trừ sâu 2+1');
    expect(screen.queryByRole('link', { name: /Tạo combo/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ngừng bán' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(search).toContain('status=inactive');
  });
});
