import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  CUSTOMER_GROUPS,
  CUSTOMER_TAGS,
  CUSTOMER_TIERS,
  ME_SALE,
  errorEnvelope,
  makeTierPromotionResult,
} from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { CustomerGroupsScreen } from './components/customer-groups-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/segments',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/components/ui/toaster', () => ({ toast: toasts }));

describe('CustomerGroupsScreen — /crm/segments (CRM-02)', () => {
  it('loading → dữ liệu thật: nhóm (kể cả ngừng dùng), cấp sắp cao → thấp, tag', async () => {
    renderApp(<CustomerGroupsScreen />);
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(await screen.findByText('Đại lý')).toBeInTheDocument();
    expect(screen.getByText('Nhóm cũ')).toBeInTheDocument();
    expect(screen.getByText('Ngừng dùng')).toBeInTheDocument();
    expect(screen.getByText('Nhóm khách hàng (3)')).toBeInTheDocument();
    // Cấp: Vàng (sortOrder 20) đứng trước Bạc; CK 1% hiển thị theo %
    const gold = await screen.findByText('Vàng');
    const silver = screen.getByText('Bạc');
    expect(gold.compareDocumentPosition(silver) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('1%')).toBeInTheDocument();
    expect(screen.getByText('≥ 300.000.000')).toBeInTheDocument();
    expect(await screen.findByText('Khách VIP')).toBeInTheDocument();
    expect(screen.queryByText(/mẫu/)).not.toBeInTheDocument();
  });

  it('thêm nhóm → POST /customer-groups với body đúng DTO', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/customer-groups', async ({ request }) => {
        const b = (await request.json()) as Record<string, unknown>;
        bodies.push(b);
        return HttpResponse.json(
          { id: 'g-new', description: null, isActive: true, ...b },
          { status: 201 },
        );
      }),
    );
    renderApp(<CustomerGroupsScreen />);
    await screen.findByText('Đại lý');
    fireEvent.click(screen.getByRole('button', { name: /Thêm nhóm/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Mã nhóm/), { target: { value: 'NHAVUON' } });
    fireEvent.change(within(dialog).getByLabelText(/Tên nhóm/), { target: { value: 'Nhà vườn' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm nhóm' }));
    await waitFor(() => expect(bodies).toEqual([{ code: 'NHAVUON', name: 'Nhà vườn' }]));
  });

  it('xóa hẳn nhóm đã ngừng còn khách → 409 GROUP_IN_USE hiện câu tiếng Việt', async () => {
    const calls: string[] = [];
    server.use(
      http.delete('/api/customer-groups/:id', ({ request, params }) => {
        calls.push(`${params.id as string}${new URL(request.url).search}`);
        return errorEnvelope(409, 'GROUP_IN_USE');
      }),
    );
    renderApp(<CustomerGroupsScreen />);
    await screen.findByText('Nhóm cũ');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa hẳn nhóm Nhóm cũ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa hẳn' }));
    await waitFor(() => expect(calls).toEqual([`${CUSTOMER_GROUPS[2]!.id}?hard=true`]));
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith(expect.stringContaining('Nhóm vẫn còn khách hàng')),
    );
  });

  it('ngừng dùng nhóm đang dùng → DELETE không kèm hard', async () => {
    const calls: string[] = [];
    server.use(
      http.delete('/api/customer-groups/:id', ({ request, params }) => {
        calls.push(`${params.id as string}${new URL(request.url).search}`);
        return HttpResponse.json({ ...CUSTOMER_GROUPS[0]!, isActive: false });
      }),
    );
    renderApp(<CustomerGroupsScreen />);
    await screen.findByText('Đại lý');
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng dùng nhóm Đại lý' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ngừng dùng' }));
    await waitFor(() => expect(calls).toEqual([CUSTOMER_GROUPS[0]!.id]));
  });

  it('thêm cấp: ngưỡng tiền là string, CK nhập % gửi tỷ lệ Decimal(6,4)', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/customer-tiers', async ({ request }) => {
        const b = (await request.json()) as Record<string, unknown>;
        bodies.push(b);
        return HttpResponse.json({ id: 't-new', discountRate: null, ...b }, { status: 201 });
      }),
    );
    renderApp(<CustomerGroupsScreen />);
    await screen.findByText('Vàng');
    fireEvent.click(screen.getByRole('button', { name: /Thêm cấp/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Mã cấp/), { target: { value: 'DIAMOND' } });
    fireEvent.change(within(dialog).getByLabelText(/Tên cấp/), { target: { value: 'Kim cương' } });
    const money = within(dialog).getByLabelText(/Ngưỡng doanh số/);
    fireEvent.focus(money);
    fireEvent.change(money, { target: { value: '1000000000' } });
    fireEvent.blur(money);
    fireEvent.change(within(dialog).getByLabelText(/Chiết khấu/), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm cấp độ' }));
    await waitFor(() =>
      expect(bodies).toEqual([
        {
          code: 'DIAMOND',
          name: 'Kim cương',
          minRevenue: '1000000000',
          sortOrder: 30,
          discountRate: '0.0300',
        },
      ]),
    );
  });

  it('xóa cấp còn khách → 409 TIER_IN_USE hiện câu tiếng Việt', async () => {
    server.use(http.delete('/api/customer-tiers/:id', () => errorEnvelope(409, 'TIER_IN_USE')));
    renderApp(<CustomerGroupsScreen />);
    await screen.findByText('Vàng');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa cấp Bạc' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }));
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith(
        expect.stringContaining('Cấp độ vẫn đang gán cho khách hàng'),
      ),
    );
  });

  it('chạy nâng hạng: xem trước (dryRun) → bảng thay đổi → chạy thật cùng kỳ from/to', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('/api/customer-tiers/promotion/run', async ({ request }) => {
        const b = (await request.json()) as Record<string, unknown>;
        bodies.push(b);
        return HttpResponse.json(makeTierPromotionResult(b.dryRun === true), { status: 201 });
      }),
    );
    renderApp(<CustomerGroupsScreen />);
    await screen.findByText('Vàng');
    fireEvent.click(screen.getByRole('button', { name: 'Chạy nâng hạng' }));
    const dialog = await screen.findByRole('dialog');
    const runBtn = within(dialog).getByRole('button', { name: 'Chạy nâng hạng' });
    expect(runBtn).toBeDisabled(); // chưa xem trước thì không chạy được
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }));
    expect(await within(dialog).findByText('KH00001')).toBeInTheDocument();
    expect(within(dialog).getByText('237')).toBeInTheDocument();
    expect(bodies[0]).toEqual({ periodMonths: 12, allowDemotion: false, dryRun: true });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Chạy nâng hạng' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({
      from: '2025-10-05T17:00:00.000Z',
      to: '2026-10-05T17:00:00.000Z',
      allowDemotion: false,
      dryRun: false,
    });
    await waitFor(() =>
      expect(toasts.success).toHaveBeenCalledWith('Đã chạy nâng hạng', expect.anything()),
    );
  });

  it('tag: chọn → xóa → DELETE trả số khách bị gỡ', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete('/api/customer-tags/:id', ({ params }) => {
        deleted.push(params.id as string);
        return HttpResponse.json({ id: params.id, unassigned: 7 });
      }),
    );
    renderApp(<CustomerGroupsScreen />);
    fireEvent.click(await screen.findByRole('option', { name: /Vụ Đông Xuân/ }));
    expect(screen.getByRole('link', { name: 'Xem khách mang tag' })).toHaveAttribute(
      'href',
      `/crm/customers?tags=${CUSTOMER_TAGS[1]!.id}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tag' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(deleted).toEqual([CUSTOMER_TAGS[1]!.id]));
    await waitFor(() =>
      expect(toasts.success).toHaveBeenCalledWith('Đã xóa tag Vụ Đông Xuân', {
        description: 'Đã gỡ khỏi 7 khách',
      }),
    );
  });

  it('sale chỉ có customer.read → không có nút thêm/sửa/xóa/chạy nâng hạng (luật 7)', async () => {
    renderApp(<CustomerGroupsScreen />, { me: { ...ME_SALE, permissions: ['customer.read'] } });
    await screen.findByText('Đại lý');
    await screen.findByText('Vàng');
    expect(screen.queryByRole('button', { name: /Thêm nhóm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm cấp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chạy nâng hạng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sửa nhóm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Xóa cấp/ })).not.toBeInTheDocument();
  });

  it('empty + error: mỗi thẻ có trạng thái riêng (luật 13)', async () => {
    server.use(
      http.get('/api/customer-groups', () => HttpResponse.json([])),
      http.get('/api/customer-tiers', () => errorEnvelope(500, 'DB_ERROR')),
    );
    renderApp(<CustomerGroupsScreen />);
    expect(await screen.findByText('Chưa có nhóm khách hàng')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    expect(CUSTOMER_TIERS.length).toBe(2);
  });
});
