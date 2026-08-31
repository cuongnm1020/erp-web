import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCustomers } from '@/test/msw/handlers';
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
