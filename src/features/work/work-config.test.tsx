import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { parseDuration, WorkConfigScreen } from './components/work-config-screen';
import { WorkReportScreen } from './components/work-report-screen';
import { formatDuration } from './labels';

let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/work-config',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const CAL = {
  weekdays: [1, 2, 3, 4, 5, 6],
  startMinute: 480,
  endMinute: 1050,
  warnPercent: 80,
  autoCloseDays: 3,
};
const CAT = {
  id: 'c-hh',
  code: 'HANG_HU',
  name: 'Hàng hư / vỡ / rò rỉ',
  description: null,
  kind: 'CUSTOMER' as const,
  defaultPriority: 'HIGH' as const,
  ownerDeptId: null,
  ownerDeptName: null,
  requiresOrder: true,
  sortOrder: 20,
  isActive: true,
  openCount: 6,
  policies: [{ id: 'p1', priority: null, firstResponseMins: 60, resolveMins: 570 }],
};
const CONFIG = {
  categories: [CAT],
  calendar: CAL,
  holidays: [{ date: '2027-01-01', name: 'Tết Dương lịch' }],
  departments: [],
};

beforeEach(() => {
  search = '';
});

describe('parseDuration ↔ formatDuration', () => {
  it('đọc được mọi giá trị đang hiển thị (nhiều đơn vị), 1 ngày = ngày làm việc', () => {
    for (const m of [15, 30, 60, 90, 125, 570, 600, 1140, 1710, 2000]) {
      expect(parseDuration(formatDuration(m, 570), 570)).toBe(m);
    }
    expect(parseDuration('2h', 570)).toBe(120);
    expect(parseDuration('1.5 giờ', 570)).toBe(90);
    expect(parseDuration('1 ngày', 570)).toBe(570);
    expect(parseDuration('45', 570)).toBe(45);
    expect(parseDuration('abc', 570)).toBeNull();
    expect(parseDuration('', 570)).toBeNull();
  });
});

describe('Cấu hình công việc', () => {
  it('tab Loại yêu cầu: bảng theo nhóm, SLA mặc định 1h / 1 ngày, đang mở', async () => {
    server.use(http.get('/api/work-config', () => HttpResponse.json(CONFIG)));
    renderApp(<WorkConfigScreen />);
    const row = await screen.findByRole('row', { name: /Hàng hư/ });
    expect(within(row).getByText('1h / 1 ngày')).toBeInTheDocument();
    expect(within(row).getByText('Phòng của người tiếp nhận')).toBeInTheDocument();
    expect(within(row).getByText('Bắt buộc')).toBeInTheDocument();
  });

  it('tab SLA: sửa ô Khẩn → PUT /work-config/sla chỉ loại đã sửa, giữ ô mặc định', async () => {
    search = 'tab=sla';
    let body: unknown = null;
    server.use(
      http.get('/api/work-config', () => HttpResponse.json(CONFIG)),
      http.put('/api/work-config/sla', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json([CAT]);
      }),
    );
    renderApp(<WorkConfigScreen />);
    fireEvent.change(await screen.findByRole('textbox', { name: /Hàng hư.*Khẩn, phản hồi đầu/ }), {
      target: { value: '30p' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Hàng hư.*Khẩn, xử lý/ }), {
      target: { value: '4h' },
    });
    expect(screen.getByText('1 loại đã sửa · chưa lưu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(body).toEqual({
        rows: [
          {
            categoryId: 'c-hh',
            default: { firstResponseMins: 60, resolveMins: 570 },
            URGENT: { firstResponseMins: 30, resolveMins: 240 },
          },
        ],
      }),
    );
  });
});

describe('Báo cáo công việc', () => {
  it('KPI yêu cầu + bảng theo loại, dưới 90% có ↓', async () => {
    const k = {
      created: 186,
      resolved: 171,
      open: 46,
      overdueOpen: 3,
      firstResponseOnTimePct: 94.1,
      resolveOnTimePct: 88.3,
      avgFirstResponseMins: 38,
      avgResolveMins: 400,
      reopened: 6,
    };
    server.use(
      http.get('/api/work-config', () => HttpResponse.json(CONFIG)),
      http.get('/api/reports/work/requests', () =>
        HttpResponse.json({
          from: '2026-09-23',
          to: '2026-10-22',
          kpis: k,
          previous: { ...k, created: 166, resolveOnTimePct: 89.7 },
          byCategory: [
            {
              categoryId: 'c-hh',
              categoryName: 'Giao hàng chậm',
              created: 52,
              resolved: 51,
              open: 14,
              overdueOpen: 1,
              firstResponseOnTimePct: 92.3,
              resolveOnTimePct: 82.4,
              avgResolveMins: 550,
              reopened: 3,
            },
          ],
          byAssignee: [],
          byOutcome: [{ outcome: 'SEND_REPLACEMENT', count: 62, pct: 36.3 }],
        }),
      ),
    );
    renderApp(<WorkReportScreen />);
    expect(await screen.findByText('88,3%')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Giao hàng chậm/ });
    expect(within(row).getByText('↓ 82,4%')).toBeInTheDocument();
    expect(screen.getByText('Gửi bù')).toBeInTheDocument();
  });
});
