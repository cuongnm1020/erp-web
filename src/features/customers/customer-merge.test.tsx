import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DUP_A,
  DUP_B,
  DUP_C,
  DUP_D,
  errorEnvelope,
  makeCustomers,
  ME_SALE,
  MERGE_LOG_ID,
  MERGE_RESULT,
} from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { Customer360Screen } from './components/customer-360-screen';
import { MergeDuplicatesScreen } from './components/merge-duplicates-screen';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers/duplicates',
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** Quản trị có customer.merge nhưng không toàn cục — lịch sử gộp phải theo từng khách. */
const ME_MERGER = {
  ...ME_SALE,
  permissions: [...ME_SALE.permissions, 'customer.merge'],
  hasGlobalAccess: false,
};

const PAIR = `phone=0912345678&ids=${DUP_A},${DUP_B}`;

beforeEach(() => {
  nav.search = '';
  nav.replace.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
});

function lastUrl(): URLSearchParams {
  const call = nav.replace.mock.calls.at(-1) as [string] | undefined;
  return new URLSearchParams(call?.[0].split('?')[1] ?? '');
}

describe('Gộp khách trùng — danh sách nhóm (CRM-10)', () => {
  it('không có customer.merge → màn không có quyền, không gọi API', async () => {
    let called = false;
    server.use(
      http.get('/api/customers/duplicates', () => {
        called = true;
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_SALE });
    expect(await screen.findByText(/không có quyền/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('loading → nhóm trùng thật; gửi take/skip theo URL', async () => {
    nav.search = 'page=2&size=50';
    const seen: string[] = [];
    server.use(
      http.get('/api/customers/duplicates', async ({ request }) => {
        seen.push(new URL(request.url).search);
        await delay(30);
        return HttpResponse.json({ items: [], total: 60 });
      }),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    expect(screen.getAllByRole('status', { name: 'Đang tải danh sách' }).length).toBeGreaterThan(0);
    await waitFor(() => expect(seen.length).toBe(1));
    const q = new URLSearchParams(seen[0]);
    expect(q.get('take')).toBe('50');
    expect(q.get('skip')).toBe('50');
  });

  it('hiện nhóm + khách; bấm SĐT chọn nhanh 2 hồ sơ (gợi ý giữ đứng đầu)', async () => {
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    const list = await screen.findByRole('list', { name: 'Nhóm khách trùng' });
    expect(within(list).getByText('Cửa hàng VTNN Minh Tâm')).toBeInTheDocument();
    expect(within(list).getAllByText('Gợi ý giữ')).toHaveLength(2);
    expect(within(list).getByText(/47 đơn · 184\.250\.000/)).toBeInTheDocument();
    expect(screen.getByText('Chọn 2 hồ sơ trong một nhóm để so sánh')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chọn nhóm 0987 445 020' }));
    const q = lastUrl();
    expect(q.get('phone')).toBe('0987445020');
    expect(q.get('ids')).toBe(`${DUP_D},${DUP_C}`);
  });

  it('tick hồ sơ: nhóm khác thì chọn lại từ đầu, quá 2 thì bỏ hồ sơ chọn trước', async () => {
    nav.search = `phone=0987445020&ids=${DUP_C},${DUP_D}`;
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    await screen.findByRole('list', { name: 'Nhóm khách trùng' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn KH-000103' }));
    expect(lastUrl().get('ids')).toBe(`${DUP_D},0000dd00-0000-4000-8000-00000000000e`);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn KH-004512' }));
    expect(lastUrl().get('phone')).toBe('0912345678');
    expect(lastUrl().get('ids')).toBe(DUP_A);
  });

  it('không còn nhóm trùng → màn trống mời xem lịch sử', async () => {
    server.use(
      http.get('/api/customers/duplicates', () => HttpResponse.json({ items: [], total: 0 })),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    expect(await screen.findByText('Không còn khách trùng số điện thoại')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem lịch sử gộp' }));
    expect(lastUrl().get('tab')).toBe('history');
  });

  it('lỗi 500 → ErrorState có traceId + thử lại', async () => {
    server.use(http.get('/api/customers/duplicates', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    expect(await screen.findByText('trace-db_error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});

describe('Gộp khách trùng — so sánh + gộp (CRM-10)', () => {
  it('so sánh 2 cột: bản giữ mặc định theo gợi ý, trường trống lấy của bản kia, link Pancake', async () => {
    nav.search = PAIR;
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    expect(await screen.findByRole('radio', { name: 'Giữ lại KH-004512' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Email: lấy của KH-013207' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Tên: lấy của KH-004512' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Nhóm khách: lấy của KH-004512' })).toBeChecked();
    expect(screen.getByRole('link', { name: /Mở hội thoại Pancake/ })).toHaveAttribute(
      'href',
      'https://pancake.vn/conv/778',
    );
    expect(screen.getByText('47 đơn · 45 đã chốt · 2 đang mở')).toBeInTheDocument();
    expect(screen.getByText('2 đơn đã chốt vẫn nằm ở hồ sơ cũ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Giữ lại KH-013207' }));
    expect(lastUrl().get('keep')).toBe(DUP_B);
  });

  it('xác nhận → POST /customers/merge với fieldChoices + idempotencyKey → kết quả → hoàn tác', async () => {
    nav.search = PAIR;
    const bodies: Array<Record<string, unknown>> = [];
    let undone = '';
    server.use(
      http.post('/api/customers/merge', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(MERGE_RESULT, { status: 201 });
      }),
      http.post('/api/customers/merge/:logId/undo', ({ params }) => {
        undone = params.logId as string;
        return HttpResponse.json({
          logId: MERGE_LOG_ID,
          survivorId: DUP_A,
          mergedId: DUP_B,
          restored: [{ key: 'core.SalesOrder.customerId', label: 'Đơn bán', count: 1 }],
          stuck: [],
          fieldsRestored: ['email'],
          fieldsNotRestored: ['name'],
          undoneAt: '2026-10-06T04:00:00.000Z',
        });
      }),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Gộp và giữ KH-004512' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Gộp KH-013207 vào KH-004512?')).toBeInTheDocument();
    expect(within(dialog).getByText('Email')).toBeInTheDocument();
    expect(
      within(dialog).getByText('2 đơn đã chốt vẫn nằm ở hồ sơ cũ, hồ sơ cũ trỏ sang khách giữ.'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gộp khách' }));

    const result = await screen.findByRole('region', { name: 'Kết quả gộp' });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      survivorId: DUP_A,
      mergedId: DUP_B,
      fieldChoices: { email: 'merged' },
    });
    expect(bodies[0]!.force).toBeUndefined();
    expect(typeof bodies[0]!.idempotencyKey).toBe('string');
    expect(toastSuccess).toHaveBeenCalledWith('Đã gộp khách', expect.anything());
    expect(within(result).getByText('Đã gộp KH-013207 vào KH-004512')).toBeInTheDocument();
    expect(
      within(result).getByText('2 đơn đã chốt vẫn nằm ở hồ sơ cũ, hồ sơ cũ trỏ sang khách giữ.'),
    ).toBeInTheDocument();
    expect(within(result).getByText('Địa chỉ giao')).toBeInTheDocument();
    expect(within(result).queryByText('Ticket')).not.toBeInTheDocument();
    expect(within(result).getByText('Trường lấy từ hồ sơ cũ: Email.')).toBeInTheDocument();
    // Gộp xong → bỏ cặp khỏi URL.
    expect(lastUrl().get('ids')).toBeNull();

    fireEvent.click(within(result).getByRole('button', { name: 'Hoàn tác' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Hoàn tác' }),
    );
    const undoneView = await screen.findByRole('region', { name: 'Kết quả hoàn tác' });
    expect(undone).toBe(MERGE_LOG_ID);
    expect(
      within(undoneView).getByText(/Giữ giá trị hiện tại vì đã sửa sau khi gộp: Tên/),
    ).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith('Đã hoàn tác gộp khách', expect.anything());
  });

  it('PHONE_MISMATCH → xác nhận lần hai → gửi force:true với key mới', async () => {
    nav.search = PAIR;
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('/api/customers/merge', async ({ request }) => {
        const b = (await request.json()) as Record<string, unknown>;
        bodies.push(b);
        if (!b.force)
          return errorEnvelope(409, 'PHONE_MISMATCH', 'x', {
            survivorPhone: '0912345678',
            mergedPhone: '0988000111',
          });
        return HttpResponse.json({ ...MERGE_RESULT, matchedOn: 'manual' }, { status: 201 });
      }),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Gộp và giữ KH-004512' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Gộp khách' }),
    );
    expect(await screen.findByText('Hai khách khác số điện thoại')).toBeInTheDocument();
    expect(screen.getByText(/0988 000 111/)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Vẫn gộp' }));
    const res = await screen.findByRole('region', { name: 'Kết quả gộp' });
    expect(within(res).getByText(/gộp thủ công/)).toBeInTheDocument();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.force).toBe(true);
    expect(bodies[1]!.idempotencyKey).not.toBe(bodies[0]!.idempotencyKey);
  });

  it('lỗi máy chủ → toast, bấm lại dùng đúng idempotencyKey cũ (luật 4)', async () => {
    nav.search = PAIR;
    const keys: unknown[] = [];
    server.use(
      http.post('/api/customers/merge', async ({ request }) => {
        keys.push(((await request.json()) as Record<string, unknown>).idempotencyKey);
        return keys.length === 1
          ? errorEnvelope(500, 'DB_ERROR')
          : HttpResponse.json(MERGE_RESULT, { status: 201 });
      }),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Gộp và giữ KH-004512' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gộp khách' }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gộp khách' }));
    await screen.findByRole('region', { name: 'Kết quả gộp' });
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('409 CUSTOMER_ALREADY_MERGED → câu tiếng Việt, không render message thô', async () => {
    nav.search = PAIR;
    server.use(
      http.post('/api/customers/merge', () =>
        errorEnvelope(409, 'CUSTOMER_ALREADY_MERGED', 'raw server text'),
      ),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Gộp và giữ KH-004512' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Gộp khách' }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/đã được gộp vào khách khác/)),
    );
  });

  it('so sánh lỗi 404 → ErrorState', async () => {
    nav.search = PAIR;
    server.use(
      http.get('/api/customers/duplicates/compare', () => errorEnvelope(404, 'NOT_FOUND')),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    expect(await screen.findByText(/Không tìm thấy dữ liệu/)).toBeInTheDocument();
  });
});

describe('Gộp khách trùng — lịch sử gộp (CRM-10)', () => {
  it('không phải quản trị toàn cục và chưa chọn khách → mời mở từ hồ sơ khách, không gọi API', async () => {
    nav.search = 'tab=history';
    let called = false;
    server.use(
      http.get('/api/customers/merge-logs', () => {
        called = true;
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    expect(await screen.findByText('Chọn một khách để xem lịch sử gộp')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('theo customerId: bảng log, hoàn tác lần còn hiệu lực', async () => {
    nav.search = `tab=history&customerId=${DUP_A}`;
    const seen: string[] = [];
    let undone = '';
    server.use(
      http.get('/api/customers/merge-logs', ({ request }) => {
        seen.push(new URL(request.url).search);
        return undefined;
      }),
      http.post('/api/customers/merge/:logId/undo', ({ params }) => {
        undone = params.logId as string;
        return HttpResponse.json({
          logId: MERGE_LOG_ID,
          survivorId: DUP_A,
          mergedId: DUP_B,
          restored: [],
          stuck: [{ key: 'core.SalesOrder.customerId', label: 'Đơn bán', count: 1 }],
          fieldsRestored: [],
          fieldsNotRestored: [],
          undoneAt: '2026-10-06T04:00:00.000Z',
        });
      }),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    expect(await screen.findByText('Đang hiệu lực')).toBeInTheDocument();
    expect(new URLSearchParams(seen[0]).get('customerId')).toBe(DUP_A);
    expect(screen.getByText('Đã hoàn tác')).toBeInTheDocument();
    expect(screen.getByText('Ngoài phạm vi của bạn')).toBeInTheDocument();
    expect(screen.getByText('Thủ công')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Hoàn tác gộp/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác gộp KH-013207 vào KH-004512' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Hoàn tác' }),
    );
    await waitFor(() => expect(undone).toBe(MERGE_LOG_ID));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã hoàn tác gộp khách', {
        description: '1 dòng đã chốt sau khi gộp không trả lại được, vẫn ở khách giữ.',
      }),
    );
  });

  it('MERGE_UNDO_CONFLICT SURVIVOR_MERGED → nhắc hoàn tác lần gộp sau trước', async () => {
    nav.search = `tab=history&customerId=${DUP_A}`;
    server.use(
      http.post('/api/customers/merge/:logId/undo', () =>
        errorEnvelope(409, 'MERGE_UNDO_CONFLICT', 'x', { reason: 'SURVIVOR_MERGED' }),
      ),
    );
    renderApp(<MergeDuplicatesScreen />, { me: ME_MERGER });
    fireEvent.click(await screen.findByRole('button', { name: /^Hoàn tác gộp KH-013207/ }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Hoàn tác' }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/hoàn tác lần gộp sau trước/)),
    );
  });

  it('quản trị toàn cục: xem toàn bộ lịch sử; rỗng → mời xem nhóm trùng', async () => {
    nav.search = 'tab=history';
    server.use(
      http.get('/api/customers/merge-logs', () => HttpResponse.json({ items: [], total: 0 })),
    );
    renderApp(<MergeDuplicatesScreen />);
    expect(await screen.findByText('Chưa có lần gộp nào')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm trùng' }));
    expect(lastUrl().get('tab')).toBeNull();
  });

  it('lỗi 500 ở lịch sử → ErrorState có traceId', async () => {
    nav.search = 'tab=history';
    server.use(http.get('/api/customers/merge-logs', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<MergeDuplicatesScreen />);
    expect(await screen.findByText('trace-db_error')).toBeInTheDocument();
  });
});

describe('Hồ sơ 360 — khách đã gộp (CRM-10)', () => {
  const FIRST = makeCustomers(1)[0]!;

  it('mergedInto → banner trỏ sang khách giữ', async () => {
    server.use(
      http.get('/api/customers/:id', () =>
        HttpResponse.json({
          ...FIRST,
          mergedIntoId: DUP_A,
          isActive: false,
          addresses: [],
          mergedInto: { id: DUP_A, code: 'KH-004512', name: 'Cửa hàng VTNN Minh Tâm' },
        }),
      ),
    );
    renderApp(<Customer360Screen id={FIRST.id} />);
    expect(await screen.findByText(/Khách này đã được gộp vào/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở hồ sơ khách giữ' })).toHaveAttribute(
      'href',
      `/crm/customers/${DUP_A}`,
    );
  });

  it('khách giữ ngoài phạm vi → báo, không có link', async () => {
    server.use(
      http.get('/api/customers/:id', () =>
        HttpResponse.json({
          ...FIRST,
          mergedIntoId: DUP_A,
          addresses: [],
          mergedInto: { id: DUP_A, code: null, name: null },
        }),
      ),
    );
    renderApp(<Customer360Screen id={FIRST.id} />);
    expect(await screen.findByText(/ngoài phạm vi bạn phụ trách/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mở hồ sơ khách giữ' })).not.toBeInTheDocument();
  });

  it('nút Lịch sử gộp chỉ hiện với customer.merge', async () => {
    const { unmount } = renderApp(<Customer360Screen id={FIRST.id} />, { me: ME_MERGER });
    expect(await screen.findByRole('link', { name: /Lịch sử gộp/ })).toHaveAttribute(
      'href',
      `/crm/customers/duplicates?tab=history&customerId=${FIRST.id}`,
    );
    unmount();
    renderApp(<Customer360Screen id={FIRST.id} />, { me: ME_SALE });
    await screen.findByRole('heading', { name: 'Khách hàng 1' });
    expect(screen.queryByRole('link', { name: /Lịch sử gộp/ })).not.toBeInTheDocument();
  });
});
