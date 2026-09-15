import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorEnvelope, makeCustomerAddresses, makeCustomers } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { CustomerFormScreen } from './components/customer-form-screen';

// Radix Select (Loại khách / Team chăm sóc) cần ResizeObserver + scrollIntoView — jsdom không có.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers/new',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const TEAM = {
  id: '00000042-0000-4000-8000-000000000001',
  code: 'SALES-HN',
  name: 'Kinh doanh Hà Nội',
  type: 'SALES',
  parentId: null,
};
const teamsHandler = http.get('/api/teams', () => HttpResponse.json([TEAM]));

/** Nút lưu xuất hiện 2 chỗ (header + footer) — bấm bản đầu tiên. */
const clickSave = (name: RegExp) => {
  fireEvent.click(screen.getAllByRole('button', { name })[0]!);
};

const fillCreateForm = async () => {
  fireEvent.change(screen.getByLabelText(/Tên khách hàng/), {
    target: { value: 'Cửa hàng An Nhiên' },
  });
  fireEvent.change(screen.getByLabelText(/Mã KH/), { target: { value: 'KH-TEST-01' } });
  fireEvent.click(screen.getByRole('combobox', { name: 'Team chăm sóc' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Kinh doanh Hà Nội' }));
};

beforeEach(() => {
  push.mockClear();
});

describe('CustomerFormScreen — POST /customers (B-03 tạo)', () => {
  it('happy path: gửi đúng body (field trống bị BỎ, không gửi chuỗi rỗng) rồi về hồ sơ', async () => {
    const posted: unknown[] = [];
    server.use(
      teamsHandler,
      http.post('/api/customers', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        posted.push(body);
        return HttpResponse.json(
          { ...makeCustomers(1)[0]!, id: 'new-cust-1', code: body.code, name: body.name },
          { status: 201 },
        );
      }),
    );
    renderApp(<CustomerFormScreen />);
    await fillCreateForm();
    clickSave(/Lưu khách hàng/);
    await waitFor(() => expect(posted).toHaveLength(1));
    // toEqual chặt: SĐT/email/MST/hạn mức/hạn thanh toán để trống → KHÔNG có trong body.
    expect(posted[0]).toEqual({
      code: 'KH-TEST-01',
      name: 'Cửa hàng An Nhiên',
      teamId: TEAM.id,
      type: 'RETAIL',
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/customers/new-cust-1'));
  });

  it('bỏ trống bắt buộc → lỗi validate tại field, KHÔNG gọi API', async () => {
    const posts: unknown[] = [];
    server.use(
      teamsHandler,
      http.post('/api/customers', () => {
        posts.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<CustomerFormScreen />);
    clickSave(/Lưu khách hàng/);
    expect(await screen.findByText('Nhập tên khách')).toBeInTheDocument();
    expect(screen.getByText('Không được để trống')).toBeInTheDocument(); // mã KH
    expect(screen.getByText('Chọn team chăm sóc')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it("'Lưu và tạo tiếp': POST xong reset form trắng, KHÔNG điều hướng", async () => {
    const posted: unknown[] = [];
    server.use(
      teamsHandler,
      http.post('/api/customers', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        posted.push(body);
        return HttpResponse.json(
          { ...makeCustomers(1)[0]!, id: 'new-cust-2', code: body.code, name: body.name },
          { status: 201 },
        );
      }),
    );
    renderApp(<CustomerFormScreen />);
    await fillCreateForm();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và tạo tiếp' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    await waitFor(() => expect(screen.getByLabelText(/Tên khách hàng/)).toHaveValue(''));
    expect(screen.getByLabelText(/Mã KH/)).toHaveValue('');
    expect(push).not.toHaveBeenCalled();
  });
});

describe('CustomerFormScreen — PATCH /customers/{id} (B-03 sửa)', () => {
  const CUST = makeCustomers(1)[0]!;

  it('prefill từ GET /customers/{id}; PATCH CHỈ field đã đổi; mã KH khóa lại', async () => {
    const patched: Array<{ id: unknown; body: unknown }> = [];
    server.use(
      http.patch('/api/customers/:id', async ({ request, params }) => {
        patched.push({ id: params.id, body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    renderApp(<CustomerFormScreen customerId={CUST.id} />);
    expect(await screen.findByLabelText(/Tên khách hàng/)).toHaveValue(CUST.name);
    expect(screen.getByLabelText('SĐT')).toHaveValue(CUST.phone);
    // UpdateCustomerDto không có `code`/`teamId` → mã disabled, team chỉ đọc (không có combobox team).
    expect(screen.getByLabelText(/Mã KH/)).toBeDisabled();
    expect(screen.queryByRole('combobox', { name: 'Team chăm sóc' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tên khách hàng/), {
      target: { value: 'Cửa hàng đã đổi tên' },
    });
    clickSave(/Lưu thay đổi/);
    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0]).toEqual({ id: CUST.id, body: { name: 'Cửa hàng đã đổi tên' } });
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/customers/${CUST.id}`));
  });
});

describe('CustomerFormScreen — địa chỉ giao hàng (POST/PATCH/DELETE /customers/{id}/addresses)', () => {
  const CUST = makeCustomers(1)[0]!;
  const [DEFAULT_ADDR, OTHER_ADDR] = makeCustomerAddresses(CUST.id) as [
    ReturnType<typeof makeCustomerAddresses>[number],
    ReturnType<typeof makeCustomerAddresses>[number],
  ];
  // Nhãn bắt buộc có dấu * kèm sau → tìm bằng regex như các test khác của form.
  const fill = (label: string | RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('bảng địa chỉ từ GET /customers/{id}: mặc định gắn nhãn, chỉ địa chỉ thường có nút "Mặc định"', async () => {
    renderApp(<CustomerFormScreen customerId={CUST.id} />);
    expect(await screen.findByText(DEFAULT_ADDR.recipient)).toBeInTheDocument();
    expect(screen.getByText('12 Lê Thanh Nghị, Phường Hai Bà Trưng, Hà Nội')).toBeInTheDocument();
    // Nhãn "Mặc định" chỉ ở dòng địa chỉ mặc định (dòng kia có NÚT "Mặc định").
    expect(
      within(screen.getByTestId(`address-${DEFAULT_ADDR.id}`)).getByText('Mặc định'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Đặt mặc định ${DEFAULT_ADDR.recipient}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Đặt mặc định ${OTHER_ADDR.recipient}` }),
    ).toBeInTheDocument();
    // Không có mục "chờ API" cho địa chỉ nữa.
    expect(screen.queryByText(/CustomerDto chưa trả addresses/)).not.toBeInTheDocument();
  });

  it('Thêm địa chỉ: dialog riêng, POST đúng body (field trống bị BỎ), KHÔNG kích hoạt PATCH khách', async () => {
    const posted: Array<{ id: unknown; body: unknown }> = [];
    const patchedCustomer: unknown[] = [];
    server.use(
      http.post('/api/customers/:id/addresses', async ({ request, params }) => {
        posted.push({ id: params.id, body: await request.json() });
        return HttpResponse.json({ ...OTHER_ADDR, id: 'addr-new' }, { status: 201 });
      }),
      http.patch('/api/customers/:id', async () => {
        patchedCustomer.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<CustomerFormScreen customerId={CUST.id} />);
    await screen.findByText(DEFAULT_ADDR.recipient);
    fireEvent.click(screen.getByRole('button', { name: /Thêm địa chỉ/ }));
    expect(await screen.findByRole('dialog', { name: 'Thêm địa chỉ' })).toBeInTheDocument();
    fill(/^Người nhận/, 'Lê Văn Cường');
    fill(/^SĐT người nhận/, '0987654321');
    fill(/^Địa chỉ/, '5 Trần Phú');
    fill(/^Tỉnh \/ thành/, 'Hà Nội');
    fireEvent.click(screen.getByRole('checkbox', { name: /mặc định/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm địa chỉ' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({
      id: CUST.id,
      body: {
        recipient: 'Lê Văn Cường',
        phone: '0987654321',
        line1: '5 Trần Phú',
        province: 'Hà Nội',
        isDefault: true,
      },
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Thêm địa chỉ' })).not.toBeInTheDocument(),
    );
    expect(patchedCustomer).toHaveLength(0);
  });

  it('Sửa địa chỉ: prefill; PATCH CHỈ field đã đổi; "Mặc định" gửi isDefault=true', async () => {
    const patched: Array<{ addressId: unknown; body: unknown }> = [];
    server.use(
      http.patch('/api/customers/:id/addresses/:addressId', async ({ request, params }) => {
        patched.push({ addressId: params.addressId, body: await request.json() });
        return HttpResponse.json(OTHER_ADDR);
      }),
    );
    renderApp(<CustomerFormScreen customerId={CUST.id} />);
    await screen.findByText(OTHER_ADDR.recipient);
    fireEvent.click(screen.getByRole('button', { name: `Sửa địa chỉ ${OTHER_ADDR.recipient}` }));
    expect(await screen.findByRole('dialog', { name: 'Sửa địa chỉ' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Người nhận/)).toHaveValue(OTHER_ADDR.recipient);
    expect(screen.getByLabelText('Thôn / xóm')).toHaveValue('Xóm Đông');
    fill(/^Địa chỉ/, 'Thôn 3, nhà số 9');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu địa chỉ' }));
    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0]).toEqual({ addressId: OTHER_ADDR.id, body: { line1: 'Thôn 3, nhà số 9' } });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Sửa địa chỉ' })).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: `Đặt mặc định ${OTHER_ADDR.recipient}` }));
    await waitFor(() => expect(patched).toHaveLength(2));
    expect(patched[1]).toEqual({ addressId: OTHER_ADDR.id, body: { isDefault: true } });
  });

  it('Xóa địa chỉ: 409 ADDRESS_IN_USE → hộp xác nhận giữ mở + nói rõ số đơn; 204 → đóng', async () => {
    let attempts = 0;
    server.use(
      http.delete('/api/customers/:id/addresses/:addressId', () => {
        attempts += 1;
        return attempts === 1
          ? errorEnvelope(409, 'CONFLICT', 'x', { code: 'ADDRESS_IN_USE', openOrders: 2 })
          : new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<CustomerFormScreen customerId={CUST.id} />);
    await screen.findByText(OTHER_ADDR.recipient);
    fireEvent.click(screen.getByRole('button', { name: `Xóa địa chỉ ${OTHER_ADDR.recipient}` }));
    expect(await screen.findByRole('dialog', { name: 'Xóa địa chỉ này?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 đơn chưa hoàn tất/);
    expect(screen.getByRole('dialog', { name: 'Xóa địa chỉ này?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(attempts).toBe(2));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Xóa địa chỉ này?' })).not.toBeInTheDocument(),
    );
  });

  it('không có customer.update → chỉ đọc: không nút Thêm / Sửa / Xóa', async () => {
    renderApp(<CustomerFormScreen customerId={CUST.id} />, {
      me: { permissions: ['customer.read'], hasGlobalAccess: false },
    });
    expect(await screen.findByText(DEFAULT_ADDR.recipient)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm địa chỉ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa địa chỉ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xóa địa chỉ/ })).not.toBeInTheDocument();
  });
});
