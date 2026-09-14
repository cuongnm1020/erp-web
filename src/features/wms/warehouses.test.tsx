import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { WarehousesScreen } from './components/warehouses-screen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/warehouses',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const WAREHOUSES = [
  {
    id: 'wh-1',
    code: 'WH01',
    name: 'Kho Hà Nội 1',
    address: 'KCN Quang Minh',
    isActive: true,
    isDefault: false,
  },
  { id: 'wh-2', code: 'WH02', name: 'Kho HCM', address: null, isActive: false, isDefault: false },
  // Kho mặc định hệ thống (đơn Pancake về đây) — có badge, không có nút Xóa / Đặt mặc định.
  { id: 'wh-3', code: 'WH03', name: 'Kho Đà Nẵng', address: null, isActive: true, isDefault: true },
];

describe('WarehousesScreen — GET/POST/PATCH/DELETE /warehouses', () => {
  beforeEach(() => {
    server.use(http.get('/api/warehouses', () => HttpResponse.json(WAREHOUSES)));
  });

  it('tải danh sách thật: mã, tên, địa chỉ, trạng thái Đang dùng / Ngừng dùng', async () => {
    renderApp(<WarehousesScreen />);
    expect(await screen.findByText('Kho Hà Nội 1')).toBeInTheDocument();
    expect(screen.getByText('3 kho')).toBeInTheDocument();
    expect(screen.getByText('KCN Quang Minh')).toBeInTheDocument();
    expect(screen.getAllByText('Đang dùng')).toHaveLength(2);
    expect(screen.getByText('Ngừng dùng')).toBeInTheDocument();
  });

  it('thêm kho: dialog → POST /warehouses đúng body, đóng + toast', async () => {
    const posts: unknown[] = [];
    server.use(
      http.post('/api/warehouses', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(
          { id: 'wh-3', code: 'WH03', name: 'Kho mới', address: null, isActive: true },
          { status: 201 },
        );
      }),
    );
    renderApp(<WarehousesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Thêm kho/ }));
    fireEvent.change(screen.getByLabelText('Mã kho'), { target: { value: 'WH03' } });
    fireEvent.change(screen.getByLabelText('Tên kho'), { target: { value: 'Kho mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm kho' }));
    await waitFor(() => expect(posts).toEqual([{ code: 'WH03', name: 'Kho mới' }]));
    await waitFor(() => expect(screen.queryByLabelText('Mã kho')).not.toBeInTheDocument());
  });

  it('sửa kho: prefill, mã bị khóa → PATCH /warehouses/:id (không gửi code)', async () => {
    const patches: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.patch('/api/warehouses/:id', async ({ request, params }) => {
        patches.push({ id: params.id as string, body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Kho Hà Nội 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sửa' })[0]!);
    expect(screen.getByDisplayValue('WH01')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tên kho'), { target: { value: 'Kho HN đổi tên' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(patches).toEqual([
        { id: 'wh-1', body: { name: 'Kho HN đổi tên', address: 'KCN Quang Minh' } },
      ]),
    );
  });

  it('xóa kho: xác nhận soft delete → DELETE /warehouses/:id', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete('/api/warehouses/:id', ({ params }) => {
        deleted.push(params.id as string);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Kho Hà Nội 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa' })[0]!);
    expect(await screen.findByText('Xóa kho WH01?')).toBeInTheDocument();
    expect(
      screen.getByText('Kho chuyển Ngừng dùng — tồn kho, vị trí và chứng từ giữ nguyên.'),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Xóa' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(deleted).toEqual(['wh-1']));
  });

  it('kho mặc định: badge "Mặc định", không có nút Xóa; "Đặt mặc định" trên kho hoạt động khác → PATCH { isDefault: true }', async () => {
    const patches: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.patch('/api/warehouses/:id', async ({ request, params }) => {
        patches.push({ id: params.id as string, body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Kho Đà Nẵng');
    expect(screen.getByText('Mặc định')).toBeInTheDocument();
    // 3 kho, chỉ 2 kho không mặc định có nút Xóa (WH01, WH02)
    expect(screen.getAllByRole('button', { name: 'Xóa' })).toHaveLength(2);
    // Chỉ kho ĐANG HOẠT ĐỘNG và chưa mặc định có "Đặt mặc định" → WH01 (WH02 ngừng dùng)
    const setDefault = screen.getAllByRole('button', { name: /Đặt mặc định/ });
    expect(setDefault).toHaveLength(1);
    fireEvent.click(setDefault[0]!);
    await waitFor(() => expect(patches).toEqual([{ id: 'wh-1', body: { isDefault: true } }]));
  });

  it('sửa kho: bật "Kho mặc định hệ thống" → PATCH kèm isDefault: true (chỉ khi đổi)', async () => {
    const patches: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.patch('/api/warehouses/:id', async ({ request, params }) => {
        patches.push({ id: params.id as string, body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    renderApp(<WarehousesScreen />);
    await screen.findByText('Kho Hà Nội 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sửa' })[0]!);
    const box = screen.getByRole('checkbox', { name: 'Kho mặc định hệ thống' });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(patches).toEqual([
        {
          id: 'wh-1',
          body: { name: 'Kho Hà Nội 1', address: 'KCN Quang Minh', isDefault: true },
        },
      ]),
    );
  });

  it('không có stock.adjust → không có Thêm kho / Sửa / Xóa / Đặt mặc định (luật 7)', async () => {
    renderApp(<WarehousesScreen />, {
      me: { ...ME_SALE, permissions: ['stock.read'] },
    });
    await screen.findByText('Kho Hà Nội 1');
    expect(screen.queryByRole('button', { name: /Thêm kho/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đặt mặc định/ })).not.toBeInTheDocument();
  });
});
