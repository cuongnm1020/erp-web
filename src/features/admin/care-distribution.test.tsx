import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorEnvelope } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import {
  CareDistributionScreen,
  previewCounts,
  runErrorText,
} from './components/care-distribution-screen';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/care-distribution',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const TEAMS = [
  { teamId: 't-mb', code: 'DEPT-CSKH-MB', name: 'CSKH Miền Bắc', memberCount: 8, percent: '50' },
  { teamId: 't-mt', code: 'DEPT-CSKH-MT', name: 'CSKH Miền Trung', memberCount: 5, percent: '30' },
  { teamId: 't-mn', code: 'DEPT-CSKH-MN', name: 'CSKH Miền Nam', memberCount: 7, percent: '20' },
];
const CONFIG = {
  teams: TEAMS,
  totalPercent: '100',
  cron: '5 0 * * *',
  runs: [
    {
      id: 'run-2',
      day: '2026-10-20',
      kind: 'DAILY',
      total: 312,
      perTeam: [
        { teamId: 't-mb', teamName: 'CSKH Miền Bắc', count: 156 },
        { teamId: 't-mt', teamName: 'CSKH Miền Trung', count: 94 },
        { teamId: 't-mn', teamName: 'CSKH Miền Nam', count: 62 },
      ],
      startedAt: '2026-10-20T17:05:00.000Z',
      finishedAt: '2026-10-20T17:05:03.000Z',
      error: null,
      actorName: 'Quản trị hệ thống',
    },
    {
      id: 'run-1',
      day: '2026-10-18',
      kind: 'DAILY',
      total: 0,
      perTeam: [],
      startedAt: '2026-10-18T17:05:00.000Z',
      finishedAt: '2026-10-18T17:05:01.000Z',
      error: 'Chưa cấu hình % chia khách cho team CSKH nào',
      actorName: null,
    },
  ],
};

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  server.use(http.get('/api/customer-care/distribution', () => HttpResponse.json(CONFIG)));
});

describe('previewCounts / runErrorText', () => {
  it('phần dư lớn nhất: tổng khớp, dư cho phần lẻ lớn nhất', () => {
    const m = previewCounts(7, [
      { id: 'A', percent: '50' },
      { id: 'B', percent: '30' },
      { id: 'C', percent: '20' },
    ]);
    expect(Object.fromEntries(m)).toEqual({ A: 4, B: 2, C: 1 });
  });

  it('lỗi lượt chia: chỉ câu đã dịch, không hiện chuỗi thô lạ', () => {
    expect(runErrorText('Chưa cấu hình % chia khách cho team CSKH nào')).toMatch(/Chưa cấu hình/);
    expect(runErrorText('connection reset by peer')).toMatch(/báo quản trị/);
  });
});

describe('CareDistributionScreen — /customer-care/distribution', () => {
  it('loading → bảng tỷ lệ, xem trước số khách, lượt gần nhất và lịch sử (lượt lỗi hiện câu đã dịch)', async () => {
    renderApp(<CareDistributionScreen />);
    expect(await screen.findByLabelText('Tỷ lệ % cho CSKH Miền Bắc')).toHaveValue('50');
    expect(screen.getByText('Đủ 100%')).toBeInTheDocument();
    // Ví dụ 100 khách → 50 / 30 / 20
    const mb = screen.getByRole('row', { name: /CSKH Miền Bắc DEPT-CSKH-MB/ });
    expect(within(mb).getByText('50')).toBeInTheDocument();
    // Lượt gần nhất (thẻ) + dòng đầu lịch sử
    expect(screen.getAllByText('312')).toHaveLength(2);
    expect(screen.getByText('Lỗi')).toBeInTheDocument();
    expect(screen.getAllByText(/Chưa cấu hình % chia khách/).length).toBeGreaterThan(0);
    // Chưa sửa gì → không lưu được
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
  });

  it('tổng ≠ 100 → chip "Còn thiếu" + khoá Lưu; sửa đúng 100 → PUT đủ các team, toast "Đã lưu thay đổi"', async () => {
    const puts: unknown[] = [];
    server.use(
      http.put('/api/customer-care/distribution', async ({ request }) => {
        puts.push(await request.json());
        return HttpResponse.json(CONFIG);
      }),
    );
    renderApp(<CareDistributionScreen />);
    const mb = await screen.findByLabelText('Tỷ lệ % cho CSKH Miền Bắc');
    fireEvent.change(mb, { target: { value: '40' } });
    expect(screen.getByText('Còn thiếu 10%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Tỷ lệ % cho CSKH Miền Nam'), {
      target: { value: '30' },
    });
    expect(screen.getByText('Đủ 100%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      items: [
        { teamId: 't-mb', percent: '40' },
        { teamId: 't-mt', percent: '30' },
        { teamId: 't-mn', percent: '30' },
      ],
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã lưu thay đổi'));
  });

  it('server từ chối (422 CARE_DISTRIBUTION_INVALID) → toast câu đã dịch', async () => {
    server.use(
      http.put('/api/customer-care/distribution', () =>
        errorEnvelope(422, 'CARE_DISTRIBUTION_INVALID'),
      ),
    );
    renderApp(<CareDistributionScreen />);
    fireEvent.change(await screen.findByLabelText('Tỷ lệ % cho CSKH Miền Bắc'), {
      target: { value: '40' },
    });
    fireEvent.change(screen.getByLabelText('Tỷ lệ % cho CSKH Miền Trung'), {
      target: { value: '40' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/tổng các team phải đúng 100%/),
      ),
    );
  });

  it('Chạy lại cho ngày → POST day, toast số khách đã chia', async () => {
    const runs: unknown[] = [];
    server.use(
      http.post('/api/customer-care/distribution/run', async ({ request }) => {
        runs.push(await request.json());
        return HttpResponse.json({ ...CONFIG.runs[0], id: 'run-3', day: '2026-10-19', total: 12 });
      }),
    );
    renderApp(<CareDistributionScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Chạy lại cho ngày/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Chạy lại cho ngày' });
    fireEvent.change(within(dialog).getByLabelText('Khách tạo ngày'), {
      target: { value: '2026-10-19' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Chạy chia khách' }));
    await waitFor(() => expect(runs).toEqual([{ day: '2026-10-19' }]));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã chia 12 khách tạo ngày 19/10/2026'),
    );
  });

  it('chưa có team CSKH → mời tạo phòng ban ở Sơ đồ nhân sự', async () => {
    server.use(
      http.get('/api/customer-care/distribution', () =>
        HttpResponse.json({ ...CONFIG, teams: [], runs: [] }),
      ),
    );
    renderApp(<CareDistributionScreen />);
    expect(await screen.findByText('Chưa có team CSKH')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở Sơ đồ nhân sự' })).toHaveAttribute(
      'href',
      '/admin/org-tree',
    );
  });

  it('403 → màn không có quyền', async () => {
    server.use(http.get('/api/customer-care/distribution', () => errorEnvelope(403, 'FORBIDDEN')));
    renderApp(<CareDistributionScreen />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});
