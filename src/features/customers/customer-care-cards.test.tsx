import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { CustomerNotesCard, CustomerPurposeCard } from './components/customer-care-cards';

const CID = '00000000-0000-4000-8000-0000000000c1';
const DURIAN = '00000000-0000-4000-8000-0000000000d1';
const COFFEE = '00000000-0000-4000-8000-0000000000d2';

const note = (id: string, body: string, mine: boolean, extra: Record<string, unknown> = {}) => ({
  id,
  customerId: CID,
  orderId: null,
  orderCode: null,
  body,
  authorId: mine ? 'u-me' : 'u-other',
  authorName: mine ? 'Ngọc' : 'Trần Thu Hà',
  authorDepartment: mine ? 'CSKH LA' : 'Phòng Arisyn',
  mine,
  createdAt: '2026-10-25T09:20:00.000Z',
  editedAt: null,
  ...extra,
});

describe('Lịch sử chăm sóc (hồ sơ khách)', () => {
  it('mới nhất trước; chỉ ghi chú của mình có Sửa / Xóa; Lưu ghi chú gửi POST', async () => {
    const posted: unknown[] = [];
    server.use(
      http.get(`/api/customer-care/customers/${CID}/notes`, () =>
        HttpResponse.json({
          total: 2,
          items: [
            note('n2', 'Khách hỏi giá thùng 20 gói', false, { orderCode: 'SO2610-00012' }),
            note('n1', 'Vườn 3ha sầu riêng', true, { editedAt: '2026-10-25T10:00:00.000Z' }),
          ],
        }),
      ),
      http.post(`/api/customer-care/customers/${CID}/notes`, async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json(note('n3', 'Hẹn gọi lại 05/11', true), { status: 201 });
      }),
    );
    renderApp(<CustomerNotesCard customerId={CID} />);
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]!).getByText('Khách hỏi giá thùng 20 gói')).toBeInTheDocument();
    expect(within(items[0]!).getByText(/Phòng Arisyn · .* · đơn SO2610-00012/)).toBeInTheDocument();
    expect(within(items[0]!).queryByRole('button', { name: 'Sửa' })).toBeNull();
    expect(within(items[1]!).getByRole('button', { name: 'Sửa' })).toBeInTheDocument();
    expect(within(items[1]!).getByText(/đã sửa/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Thêm ghi chú'), {
      target: { value: 'Hẹn gọi lại 05/11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Lưu ghi chú/ }));
    await waitFor(() => expect(posted).toEqual([{ body: 'Hẹn gọi lại 05/11' }]));
  });
});

describe('Mục đích sử dụng (hồ sơ khách)', () => {
  it('hiện người gắn; bấm chip mục đích chưa có → POST gắn; gõ trùng không dấu → nhắc, không tạo', async () => {
    const added: unknown[] = [];
    server.use(
      http.get('/api/customer-purposes', () =>
        HttpResponse.json([
          { id: DURIAN, name: 'Sầu riêng', color: null, customerCount: 3 },
          { id: COFFEE, name: 'Cà phê', color: null, customerCount: 1 },
        ]),
      ),
      http.get(`/api/customer-care/customers/${CID}/purposes`, () =>
        HttpResponse.json([
          {
            id: DURIAN,
            name: 'Sầu riêng',
            taggedAt: '2026-10-25T09:20:00.000Z',
            taggedById: 'u-me',
            taggedByName: 'Ngọc',
          },
        ]),
      ),
      http.post(`/api/customer-care/customers/${CID}/purposes`, async ({ request }) => {
        added.push(await request.json());
        return HttpResponse.json([]);
      }),
    );
    renderApp(<CustomerPurposeCard customerId={CID} />);
    expect(await screen.findByText(/Ngọc gắn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gắn mục đích' }));
    // "Sầu riêng" khách đã có → bật sẵn, khóa.
    expect(await screen.findByRole('button', { name: 'Sầu riêng', pressed: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cà phê' }));
    await waitFor(() => expect(added).toEqual([{ tagIds: [COFFEE] }]));

    fireEvent.change(screen.getByLabelText('Tạo mục đích mới'), { target: { value: 'sau RIENG' } });
    expect(screen.getByText(/Đã có “Sầu riêng”/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tạo & gắn/ })).toBeDisabled();
  });
});
