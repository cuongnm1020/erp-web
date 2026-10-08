import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import type { Warehouse } from './api/use-warehouses';
import { WarehouseLayoutImage } from './components/warehouse-layout-image';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/components/ui/toaster', () => ({ toast: toasts }));

const WH: Warehouse = {
  id: 'wh-1',
  code: 'KHO-TT-01',
  name: 'Kho Thạch Thất',
  address: null,
  contactName: null,
  phone: null,
  hamlet: null,
  ward: null,
  province: null,
  isActive: true,
  isDefault: true,
  layoutImageUrl: null,
};
const URL_3D = 'https://s3.test/warehouses/wh-1/layout-1.png?X-Amz-Signature=x';

describe('WarehouseLayoutImage — PUT/DELETE /warehouses/:id/layout-image', () => {
  it('chưa có ảnh: hiện trạng thái trống; chọn file → PUT multipart field "file"', async () => {
    const uploads: Array<{ id: string; size: number | undefined }> = [];
    server.use(
      http.put('/api/warehouses/:id/layout-image', async ({ request, params }) => {
        const fd = await request.formData();
        // jsdom→undici làm mất tên file — so theo kích thước
        uploads.push({ id: params.id as string, size: (fd.get('file') as File | null)?.size });
        return HttpResponse.json({ ...WH, layoutImageUrl: URL_3D });
      }),
    );
    renderApp(<WarehouseLayoutImage warehouse={WH} canAdjust />);
    expect(screen.getByText(/Kho chưa có ảnh 3D mặt bằng/)).toBeInTheDocument();
    const file = new File([new Uint8Array(123)], 'kho-3d.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Chọn ảnh 3D mặt bằng'), {
      target: { files: [file] },
    });
    await waitFor(() => expect(uploads).toEqual([{ id: 'wh-1', size: 123 }]));
  });

  it('chặn file sai định dạng ở client — không gọi API', async () => {
    let called = false;
    server.use(
      http.put('/api/warehouses/:id/layout-image', () => {
        called = true;
        return HttpResponse.json(WH);
      }),
    );
    renderApp(<WarehouseLayoutImage warehouse={WH} canAdjust />);
    fireEvent.change(screen.getByLabelText('Chọn ảnh 3D mặt bằng'), {
      target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] },
    });
    expect(toasts.error).toHaveBeenCalledWith('Chỉ nhận ảnh jpg / png / webp');
    expect(called).toBe(false);
  });

  it('có ảnh: hiện ảnh; Gỡ ảnh qua xác nhận → DELETE', async () => {
    const deletes: string[] = [];
    server.use(
      http.delete('/api/warehouses/:id/layout-image', ({ params }) => {
        deletes.push(params.id as string);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<WarehouseLayoutImage warehouse={{ ...WH, layoutImageUrl: URL_3D }} canAdjust />);
    expect(screen.getByAltText('Phối cảnh 3D mặt bằng kho KHO-TT-01')).toHaveAttribute(
      'src',
      URL_3D,
    );
    expect(screen.getByRole('button', { name: /Thay ảnh/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gỡ ảnh/ }));
    const confirm = await screen.findAllByRole('button', { name: 'Gỡ ảnh' });
    fireEvent.click(confirm[confirm.length - 1]!);
    await waitFor(() => expect(deletes).toEqual(['wh-1']));
  });

  it('không có stock.adjust: chỉ xem ảnh, không có nút tải / gỡ (luật 7)', () => {
    renderApp(
      <WarehouseLayoutImage warehouse={{ ...WH, layoutImageUrl: URL_3D }} canAdjust={false} />,
    );
    expect(screen.getByAltText('Phối cảnh 3D mặt bằng kho KHO-TT-01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thay ảnh|Tải ảnh 3D|Gỡ ảnh/ })).toBeNull();
  });
});
