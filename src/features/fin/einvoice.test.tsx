import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { EInvoiceDetailScreen } from './components/einvoice-detail-screen';
import { EInvoiceListScreen } from './components/einvoice-list-screen';
import { EInvoiceSettingsScreen } from './components/einvoice-settings-screen';

let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/fin/einvoices',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

const ME_ACCOUNTANT = {
  ...ME_SALE,
  permissions: ['einvoice.read', 'einvoice.review', 'einvoice.issue', 'einvoice.config'],
};

const item = (over: Record<string, unknown>) => ({
  id: 'ei-1',
  salesOrderId: 'so-1',
  orderDocNumber: 'SOP2610-00001',
  carrierCode: 'VTP',
  trackingNo: 'PKE1553212639',
  status: 'PENDING_REVIEW',
  source: 'RECON',
  deliveredAt: '2026-10-27T03:00:00Z',
  reconciledAt: '2026-10-28T03:00:00Z',
  expectedAmount: '170000',
  collectedAmount: '170000',
  targetAmount: '170000',
  subtotal: '160053',
  vatAmount: '9947',
  total: '170000',
  ratePercents: ['5', '8'],
  buyerName: 'Trần Thị Nhận',
  buyerTaxCode: null,
  issues: [],
  blocked: false,
  skipReason: null,
  invSeries: null,
  invNo: null,
  errorMessage: null,
  version: 1,
  ...over,
});

const COUNTS = { PENDING_REVIEW: 2, APPROVED: 0, PUSHED: 0, ISSUED: 5, FAILED: 1, SKIPPED: 3 };

const line = (over: Record<string, unknown>) => ({
  key: '11111111-1111-4111-8111-111111111111',
  skuId: 'sku-1',
  skuCode: 'KALIBO30',
  name: 'Phân vi lượng bón rễ KDI11 30g',
  unitName: 'Gói',
  orderQuantity: '3',
  quantity: '3',
  amount: '200000',
  taxRateId: 'tr-5',
  taxCode: 'VAT5',
  taxKind: 'TAXABLE',
  ratePercent: '5',
  unitPrice: '63492.06',
  netAmount: '190476',
  vatAmount: '9524',
  itemType: 0,
  ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  ...item({
    id: 'ei-2',
    orderDocNumber: 'SOP2610-00002',
    expectedAmount: '300000',
    collectedAmount: '200000',
    targetAmount: '200000',
    subtotal: '190476',
    vatAmount: '9524',
    total: '200000',
    ratePercents: ['5'],
    issues: ['PARTIAL_DELIVERY'],
    blocked: true,
    version: 4,
  }),
  customerId: 'c-1',
  reconLineId: 'rl-1',
  lines: [line({})],
  buyer: {
    legalName: null,
    fullName: 'Trần Thị Nhận',
    taxCode: null,
    idNumber: null,
    address: 'Thôn 4, Xã Thạch Thất, Hà Nội',
    phone: '0911222333',
    email: null,
    customerCode: 'KH001',
  },
  linesEdited: false,
  reviewedBy: null,
  reviewedByName: null,
  reviewedAt: null,
  pushedBy: null,
  pushedByName: null,
  pushedAt: null,
  invDate: null,
  transactionId: null,
  invCode: null,
  publishStatus: null,
  errorCode: null,
  lastSyncedAt: null,
  createdAt: '2026-10-28T03:00:00Z',
  updatedAt: '2026-10-28T03:00:00Z',
  ...over,
});

let listQueries: URLSearchParams[] = [];
let actions: Array<{ path: string; body: unknown }> = [];
let patches: unknown[] = [];
let puts: unknown[] = [];

beforeEach(() => {
  search = '';
  listQueries = [];
  actions = [];
  patches = [];
  puts = [];
  toastSuccess.mockClear();
  toastError.mockClear();
  server.use(
    http.get('/api/einvoices', ({ request }) => {
      listQueries.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        items: [
          item({}),
          item({
            id: 'ei-3',
            orderDocNumber: 'SOP2610-00003',
            issues: ['MISSING_TAX_RATE', 'NOT_RECONCILED'],
            blocked: true,
            ratePercents: ['?'],
            collectedAmount: null,
          }),
        ],
        total: 2,
        counts: COUNTS,
      });
    }),
    http.post('/api/einvoices/:action', async ({ request, params }) => {
      actions.push({ path: String(params.action), body: await request.json().catch(() => null) });
      if (params.action === 'sync') return HttpResponse.json({ checked: 4, issued: 2 });
      return HttpResponse.json({ done: 1, failed: [] });
    }),
    http.get('/api/einvoices/:id', () => HttpResponse.json(detail())),
    http.patch('/api/einvoices/:id', async ({ request }) => {
      patches.push(await request.json());
      return HttpResponse.json(
        detail({ version: 5, issues: [], blocked: false, linesEdited: true }),
      );
    }),
  );
});

describe('EInvoiceListScreen — hàng chờ hóa đơn điện tử', () => {
  it('tab Chờ duyệt mặc định, đếm theo trạng thái, vấn đề chặn hiện rõ', async () => {
    renderApp(<EInvoiceListScreen />, { me: ME_ACCOUNTANT });
    expect(await screen.findByText('SOP2610-00001')).toBeInTheDocument();
    expect(listQueries[0]!.get('status')).toBe('PENDING_REVIEW');
    const tabs = screen.getByRole('tablist', { name: 'Trạng thái' });
    expect(within(tabs).getByRole('tab', { name: /Chờ duyệt\s*2/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(tabs).getByRole('tab', { name: /Lỗi\s*1/ })).toBeInTheDocument();
    expect(screen.getByText('Sẵn sàng')).toBeInTheDocument();
    expect(screen.getByText(/Sản phẩm chưa gán thuế suất\s*\+1/)).toBeInTheDocument();
    expect(screen.getByText('Chưa đối soát')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SOP2610-00001' })).toHaveAttribute(
      'href',
      '/fin/einvoices/ei-1',
    );
  });

  it('chọn dòng → Duyệt gửi đúng id', async () => {
    renderApp(<EInvoiceListScreen />, { me: ME_ACCOUNTANT });
    await screen.findByText('SOP2610-00001');
    const rowCheckbox = screen.getAllByRole('checkbox', { name: /Chọn dòng/ })[0]!;
    fireEvent.click(rowCheckbox);
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt 1 hóa đơn' }));
    await waitFor(() => expect(actions).toHaveLength(1));
    expect(actions[0]).toEqual({ path: 'approve', body: { ids: ['ei-1'] } });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã duyệt 1 hóa đơn'));
  });

  it('chỉ có quyền xem: không có nút nhập đối soát / lấy kết quả', async () => {
    renderApp(<EInvoiceListScreen />, { me: { ...ME_SALE, permissions: ['einvoice.read'] } });
    await screen.findByText('SOP2610-00001');
    expect(screen.queryByRole('button', { name: /Nhập đối soát hãng/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lấy kết quả từ MISA' })).not.toBeInTheDocument();
  });

  it('Lấy kết quả từ MISA → báo số hóa đơn đã có số', async () => {
    renderApp(<EInvoiceListScreen />, { me: ME_ACCOUNTANT });
    await screen.findByText('SOP2610-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Lấy kết quả từ MISA' }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Đã lấy kết quả từ MISA: 2 hóa đơn có số / 4 đã kiểm',
      ),
    );
  });
});

describe('EInvoiceDetailScreen — giao một phần', () => {
  it('chặn duyệt tới khi sửa; sửa SL 2 + tiền 200.000 → PATCH đúng dòng + version', async () => {
    renderApp(<EInvoiceDetailScreen id="ei-2" />, { me: ME_ACCOUNTANT });
    expect(await screen.findByText(/Hãng thu thiếu — sửa số lượng khách nhận/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duyệt' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Số lượng dòng 1'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Khách trả dòng 1'), { target: { value: '200.000' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      version: 4,
      lines: [{ key: '11111111-1111-4111-8111-111111111111', quantity: '2', amount: '200000' }],
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã lưu thay đổi'));
  });

  it('tổng theo thuế suất + tiền hãng thu', async () => {
    renderApp(<EInvoiceDetailScreen id="ei-2" />, { me: ME_ACCOUNTANT });
    await screen.findByText('Phân vi lượng bón rễ KDI11 30g');
    expect(screen.getByText('Tổng cộng')).toBeInTheDocument();
    expect(screen.getByText(/Hãng thu 200\.000/)).toBeInTheDocument();
  });
});

describe('EInvoiceSettingsScreen', () => {
  const SETTING = {
    baseUrl: 'https://developer.misa.vn/apis/itg/meinvoice',
    clientId: '01a1-client',
    hasClientSecret: true,
    taxCode: '0111043552',
    username: 'tichhop@tn.vn',
    hasPassword: false,
    secretsUnreadable: false,
    templateId: null,
    invSeries: null,
    invoiceWithCode: true,
    isCashRegister: true,
    requireTwoPeople: true,
    lastVerifiedAt: null,
    lastVerifyError: null,
    updatedAt: '2026-10-28T03:00:00Z',
  };

  beforeEach(() => {
    server.use(
      http.get('/api/einvoices/settings', () => HttpResponse.json(SETTING)),
      http.put('/api/einvoices/settings', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        puts.push(body);
        return HttpResponse.json({ ...SETTING, ...body, hasPassword: true });
      }),
      http.post('/api/einvoices/settings/verify', () =>
        HttpResponse.json({
          ok: true,
          error: null,
          templates: [
            {
              templateId: 'tpl-mtt',
              templateName: 'HĐ máy tính tiền',
              invTemplateNo: '1',
              invSeries: '1C26MAB',
              inactive: false,
              isMoreVatRate: true,
            },
          ],
          setting: { ...SETTING, lastVerifiedAt: '2026-10-28T04:00:00Z' },
        }),
      ),
    );
  });

  it('bí mật không hiện lại; chỉ gửi mật khẩu khi nhập mới', async () => {
    renderApp(<EInvoiceSettingsScreen />, { me: ME_ACCOUNTANT });
    expect(await screen.findByDisplayValue('01a1-client')).toBeInTheDocument();
    expect(screen.getByText(/đã lưu, để trống nếu không đổi/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: 'pw-dev' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ password: 'pw-dev', clientId: '01a1-client' });
    expect(puts[0]).not.toHaveProperty('clientSecret');
  });

  it('kiểm tra kết nối → chọn mẫu gửi templateId + ký hiệu', async () => {
    renderApp(<EInvoiceSettingsScreen />, { me: ME_ACCOUNTANT });
    await screen.findByDisplayValue('01a1-client');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dùng mẫu này' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ templateId: 'tpl-mtt', invSeries: '1C26MAB' });
  });
});
