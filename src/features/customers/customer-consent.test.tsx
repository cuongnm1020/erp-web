import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_CONSENTS, errorEnvelope } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { CustomerConsentCard } from './components/customer-consent-card';
import {
  MarketingConsentScreen,
  toConsentFilterParams,
} from './components/marketing-consent-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers/consent',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const CID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  search = '';
  replace.mockClear();
});

describe('CustomerConsentCard — GET/POST /customers/:id/consents (CRM-13)', () => {
  it('loading → 4 kênh hiện tại (Đồng ý / Từ chối / Chưa ghi nhận) + lịch sử kèm bằng chứng', async () => {
    renderApp(<CustomerConsentCard customerId={CID} />);
    expect(screen.getByRole('status', { name: 'Đang tải đồng ý nhận tin' })).toBeInTheDocument();
    const sms = await screen.findByRole('listitem', { name: 'Kênh SMS' });
    expect(within(sms).getByText('Đồng ý')).toBeInTheDocument();
    expect(within(sms).getByText(/Cuộc gọi ·/)).toBeInTheDocument();
    const zalo = screen.getByRole('listitem', { name: 'Kênh Zalo' });
    expect(within(zalo).getByText('Từ chối')).toBeInTheDocument();
    const email = screen.getByRole('listitem', { name: 'Kênh Email' });
    expect(within(email).getByText('Chưa ghi nhận')).toBeInTheDocument();

    expect(screen.getByText('Lịch sử ghi nhận (2)')).toBeInTheDocument();
    expect(screen.getByText('Ghi âm cuộc gọi CG-0412')).toBeInTheDocument();
    expect(
      screen.getByText('IP 203.0.113.7 · Trình duyệt: Mozilla/5.0 (iPhone)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Trần Thị Mai')).toBeInTheDocument();
    expect(screen.getByText('Khách tự thao tác / hệ thống')).toBeInTheDocument();
    expect(screen.getAllByText('Marketing').length).toBe(2);
  });

  it('lịch sử phân trang phía server: take/skip theo ?consentPage', async () => {
    search = 'consentPage=2';
    const seen: string[] = [];
    server.use(
      http.get('/api/customers/:id/consents', ({ request }) => {
        const u = new URL(request.url);
        seen.push(`${u.searchParams.get('take')}/${u.searchParams.get('skip')}`);
        return HttpResponse.json({
          customerId: CID,
          current: [],
          history: { items: [], total: 0 },
        });
      }),
    );
    renderApp(<CustomerConsentCard customerId={CID} />);
    await waitFor(() => expect(seen).toContain('20/20'));
  });

  it('chưa có bản ghi → EmptyState mời ghi nhận', async () => {
    server.use(
      http.get('/api/customers/:id/consents', () =>
        HttpResponse.json({
          customerId: CID,
          current: [
            { channel: 'EMAIL', granted: null, recordedAt: null, source: null },
            { channel: 'SMS', granted: null, recordedAt: null, source: null },
            { channel: 'ZALO', granted: null, recordedAt: null, source: null },
            { channel: 'PHONE_CALL', granted: null, recordedAt: null, source: null },
          ],
          history: { items: [], total: 0 },
        }),
      ),
    );
    renderApp(<CustomerConsentCard customerId={CID} />);
    expect(await screen.findByText('Chưa có bản ghi đồng ý nào')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa hỏi khách — không gửi marketing')).toHaveLength(4);
  });

  it('500 → ErrorState có traceId', async () => {
    server.use(http.get('/api/customers/:id/consents', () => errorEnvelope(500, 'DB_ERROR')));
    renderApp(<CustomerConsentCard customerId={CID} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });

  it('ghi nhận: chọn kênh, Từ chối, nguồn, ghi chú → POST đúng body, đóng dialog, tải lại', async () => {
    const bodies: unknown[] = [];
    let gets = 0;
    server.use(
      http.get('/api/customers/:id/consents', () => {
        gets++;
        return HttpResponse.json(CUSTOMER_CONSENTS);
      }),
      http.post('/api/customers/:id/consents', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          {
            id: 'x',
            customerId: CID,
            channel: 'SMS',
            granted: false,
            source: 'FORM',
            purpose: 'MARKETING',
            evidence: { note: 'Phiếu 12' },
            recordedAt: '2026-10-06T03:00:00.000Z',
            recordedBy: { id: 'u', name: 'Quản trị' },
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<CustomerConsentCard customerId={CID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận kênh SMS' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Từ chối / rút lại' }));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Nguồn' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Form đăng ký' }));
    fireEvent.change(within(dialog).getByLabelText('Ghi chú bằng chứng'), {
      target: { value: 'Phiếu 12' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi nhận' }));
    await waitFor(() =>
      expect(bodies).toEqual([
        {
          channel: 'SMS',
          granted: false,
          source: 'FORM',
          purpose: 'MARKETING',
          evidence: 'Phiếu 12',
        },
      ]),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(gets).toBeGreaterThanOrEqual(2));
  });

  it('mục đích sai định dạng → chặn ở form (schema chung), không gọi API', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/customers/:id/consents', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(<CustomerConsentCard customerId={CID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận thay đổi' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Mục đích'), {
      target: { value: 'khuyen mai' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi nhận' }));
    expect(await within(dialog).findByText(/Chữ IN HOA/)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('404 khi ghi (khách ngoài phạm vi) → lỗi qua bộ dịch, dialog giữ nguyên', async () => {
    server.use(http.post('/api/customers/:id/consents', () => errorEnvelope(404, 'NOT_FOUND')));
    renderApp(<CustomerConsentCard customerId={CID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận thay đổi' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi nhận' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Không tìm thấy dữ liệu/);
  });

  it('không có customer.update → chỉ đọc, không có nút ghi nhận (luật 7)', async () => {
    renderApp(<CustomerConsentCard customerId={CID} />, {
      me: { permissions: ['customer.read'], hasGlobalAccess: false },
    });
    await screen.findByRole('listitem', { name: 'Kênh SMS' });
    expect(screen.queryByRole('button', { name: 'Ghi nhận thay đổi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ghi nhận kênh SMS' })).not.toBeInTheDocument();
  });
});

describe('MarketingConsentScreen — GET /consents (CRM-13)', () => {
  it('loading → bảng thật, tổng trên tiêu đề, mã KH dẫn tới hồ sơ', async () => {
    renderApp(<MarketingConsentScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'KH-000001' });
    expect(link).toHaveAttribute('href', '/crm/customers/00000000-0000-4000-8000-000000000001');
    expect(screen.getByText(/60 trạng thái trong phạm vi bạn phụ trách/)).toBeInTheDocument();
    expect(screen.getByText('1–50 / 60 dòng')).toBeInTheDocument();
    expect(screen.queryByText('Cửa hàng VTNN Minh Tâm')).not.toBeInTheDocument();
  });

  it('bộ lọc trên URL → tham số API (kênh / trạng thái / khoảng ngày / tìm / trang)', async () => {
    search = 'channel=SMS&granted=false&from=2026-10-01&to=2026-10-31&q=minh&page=2';
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/consents', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderApp(<MarketingConsentScreen />);
    expect(await screen.findByText('Không có trạng thái nào khớp')).toBeInTheDocument();
    const p = seen[0]!;
    expect(p.get('channel')).toBe('SMS');
    expect(p.get('granted')).toBe('false');
    expect(p.get('from')).toBe('2026-10-01');
    expect(p.get('to')).toBe('2026-10-31');
    expect(p.get('q')).toBe('minh');
    expect(p.get('take')).toBe('50');
    expect(p.get('skip')).toBe('50');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(replace).toHaveBeenCalledWith('/crm/customers/consent', { scroll: false });
  });

  it('toConsentFilterParams bỏ giá trị lạ dán tay', () => {
    expect(
      toConsentFilterParams({ channel: 'FAX', granted: 'maybe', from: '01/10/2026', to: '' }),
    ).toEqual({ channel: undefined, granted: undefined, from: undefined, to: undefined });
    expect(toConsentFilterParams({ channel: 'ZALO', granted: 'true' })).toMatchObject({
      channel: 'ZALO',
      granted: true,
    });
  });

  it('chưa có dữ liệu → EmptyState dẫn về danh sách khách', async () => {
    server.use(http.get('/api/consents', () => HttpResponse.json({ items: [], total: 0 })));
    renderApp(<MarketingConsentScreen />);
    expect(await screen.findByText('Chưa ghi nhận đồng ý nào')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách khách hàng' })).toBeInTheDocument();
  });

  it('500 → ErrorState có traceId; 403 → màn không có quyền', async () => {
    server.use(http.get('/api/consents', () => errorEnvelope(500, 'DB_ERROR')));
    const { unmount } = renderApp(<MarketingConsentScreen />);
    expect(await screen.findByText('trace-db_error')).toBeInTheDocument();
    unmount();
    server.use(http.get('/api/consents', () => errorEnvelope(403, 'FORBIDDEN')));
    renderApp(<MarketingConsentScreen />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});
