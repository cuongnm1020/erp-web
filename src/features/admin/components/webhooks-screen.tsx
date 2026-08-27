'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, RefreshCw } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

interface EndpointRow {
  name: string;
  url: string;
  event: string;
  status: 'active' | 'paused';
  ok30d: string;
  fail30d: string;
  lastCalledAt: string;
}

interface JobRow {
  job: string;
  endpoint: string;
  ref: string;
  status: 'ok' | 'failed' | 'pending';
  attempts: string;
  lastError: string | null;
  at: string;
  canRetry?: boolean;
  selected?: boolean;
}

const JOB_STATUS: Record<JobRow['status'], { label: string; tone: StatusTone }> = {
  ok: { label: 'Thành công', tone: 'ok' },
  failed: { label: 'Thất bại', tone: 'err' },
  pending: { label: 'Đang chờ', tone: 'warn' },
};

const SAMPLE_ENDPOINTS: EndpointRow[] = [
  {
    name: 'GHN — tạo vận đơn',
    url: 'https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create',
    event: 'order.confirmed',
    status: 'active',
    ok30d: '4.812',
    fail30d: '3',
    lastCalledAt: '23/08/2026 10:12',
  },
  {
    name: 'GHTK — tạo vận đơn',
    url: 'https://services.giaohangtietkiem.vn/services/shipment/order',
    event: 'order.confirmed',
    status: 'active',
    ok30d: '1.203',
    fail30d: '0',
    lastCalledAt: '23/08/2026 09:58',
  },
  {
    name: 'VNPay — đối soát',
    url: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
    event: 'payment.received',
    status: 'active',
    ok30d: '880',
    fail30d: '0',
    lastCalledAt: '23/08/2026 09:30',
  },
  {
    name: 'Zalo OA — thông báo đơn',
    url: 'https://openapi.zalo.me/v3.0/oa/message/cs',
    event: 'order.shipped',
    status: 'active',
    ok30d: '3.344',
    fail30d: '1',
    lastCalledAt: '23/08/2026 10:10',
  },
  {
    name: 'Kế toán MISA — đồng bộ hóa đơn',
    url: 'https://api.misa.vn/erp/v1/invoices',
    event: 'invoice.issued',
    status: 'paused',
    ok30d: '412',
    fail30d: '0',
    lastCalledAt: '20/08/2026 18:00',
  },
  {
    name: 'BI nội bộ — sự kiện tồn',
    url: 'https://bi.congty.vn/ingest/stock',
    event: 'stock.moved',
    status: 'active',
    ok30d: '28.910',
    fail30d: '0',
    lastCalledAt: '23/08/2026 10:14',
  },
  {
    name: 'Slack #kho — ngoại lệ',
    url: 'https://hooks.slack.com/services/T0…/B0…',
    event: 'exception.created',
    status: 'active',
    ok30d: '97',
    fail30d: '0',
    lastCalledAt: '23/08/2026 10:05',
  },
];

const SAMPLE_JOBS: JobRow[] = [
  {
    job: 'JOB-881204',
    endpoint: 'GHN — tạo vận đơn',
    ref: 'SO-2608-01198',
    status: 'failed',
    attempts: '3/5',
    lastError: 'HTTP 400 · "to_district_id không hợp lệ"',
    at: '10:12:40',
    canRetry: true,
    selected: true,
  },
  {
    job: 'JOB-881203',
    endpoint: 'Zalo OA — thông báo đơn',
    ref: 'SO-2608-01220',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '10:10:02',
  },
  {
    job: 'JOB-881202',
    endpoint: 'BI nội bộ — sự kiện tồn',
    ref: 'GRN-2608-00087',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '10:11:31',
  },
  {
    job: 'JOB-881201',
    endpoint: 'GHN — tạo vận đơn',
    ref: 'SO-2608-01220',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '10:09:15',
  },
  {
    job: 'JOB-881200',
    endpoint: 'Slack #kho — ngoại lệ',
    ref: 'EX-2608-00019',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '10:05:04',
  },
  {
    job: 'JOB-881199',
    endpoint: 'Zalo OA — thông báo đơn',
    ref: 'SO-2608-01217',
    status: 'pending',
    attempts: '2/5',
    lastError: 'Timeout 10s · thử lại lúc 10:20',
    at: '10:04:50',
  },
  {
    job: 'JOB-881198',
    endpoint: 'GHN — tạo vận đơn',
    ref: 'SO-2608-01190',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '09:58:20',
  },
  {
    job: 'JOB-881197',
    endpoint: 'VNPay — đối soát',
    ref: 'PAY-2608-00214',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '09:58:13',
  },
  {
    job: 'JOB-881196',
    endpoint: 'BI nội bộ — sự kiện tồn',
    ref: 'GDN-2608-01133',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '09:55:02',
  },
  {
    job: 'JOB-881195',
    endpoint: 'GHTK — tạo vận đơn',
    ref: 'SO-2608-01184',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '09:52:44',
  },
  {
    job: 'JOB-881194',
    endpoint: 'Zalo OA — thông báo đơn',
    ref: 'SO-2608-01184',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '09:52:40',
  },
  {
    job: 'JOB-881193',
    endpoint: 'Slack #kho — ngoại lệ',
    ref: 'EX-2608-00018',
    status: 'ok',
    attempts: '1/5',
    lastError: null,
    at: '09:30:16',
  },
  {
    job: 'JOB-881192',
    endpoint: 'GHN — tạo vận đơn',
    ref: 'SO-2608-01176',
    status: 'ok',
    attempts: '2/5',
    lastError: 'Lần 1: timeout',
    at: '09:21:05',
  },
];

function FilterChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={
        active
          ? 'inline-flex h-7 items-center gap-1 rounded-md bg-secondary px-2.5 text-xs font-semibold text-primary'
          : 'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs text-muted-foreground hover:bg-muted'
      }
    >
      {label}
      <ChevronDown className="h-3 w-3" aria-hidden />
    </button>
  );
}

export function WebhooksScreen() {
  return (
    <>
      <PageHeader
        title="Webhook & tích hợp"
        description="7 endpoint · hàng đợi: 2 đang chờ · 1 thất bại · 39.658 thành công trong 30 ngày"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Hệ thống' }, { label: 'Webhook & tích hợp' }]}
        actions={
          <>
            <Button variant="outline">Khóa API</Button>
            <Button>Thêm endpoint</Button>
          </>
        }
      />
      <section className="rounded-md border bg-card">
        <h2 className="border-b px-3 py-2 text-sm font-semibold">Endpoint</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="px-2.5">Tên</TableHead>
                <TableHead className="px-2.5">URL</TableHead>
                <TableHead className="px-2.5">Sự kiện</TableHead>
                <TableHead className="px-2.5">Trạng thái</TableHead>
                <TableHead className="px-2.5 text-right">Thành công 30d</TableHead>
                <TableHead className="px-2.5 text-right">Thất bại 30d</TableHead>
                <TableHead className="px-2.5 text-right">Gọi cuối</TableHead>
                <TableHead className="px-2.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_ENDPOINTS.map((e) => (
                <TableRow key={e.name}>
                  <TableCell className="px-2.5 py-1.5 font-semibold">{e.name}</TableCell>
                  <TableCell className="max-w-72 truncate px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                    {e.url}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{e.event}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    {e.status === 'active' ? (
                      <StatusBadge tone="ok">Hoạt động</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Tạm dừng</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{e.ok30d}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {e.fail30d}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {e.lastCalledAt}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                    <button type="button" className="text-primary hover:underline">
                      Sửa
                    </button>
                    <span className="text-muted-foreground"> · </span>
                    <button type="button" className="text-primary hover:underline">
                      Gửi thử
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-3 rounded-md border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <h2 className="mr-1 text-sm font-semibold">Nhật ký hàng đợi</h2>
          <FilterChip label="Endpoint: Tất cả" />
          <FilterChip label="Trạng thái: Tất cả" active />
          <FilterChip label="Hôm nay" />
          <span className="ml-auto text-xs text-muted-foreground">Tự làm mới 30 giây</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="px-2.5">Job</TableHead>
                <TableHead className="px-2.5">Endpoint</TableHead>
                <TableHead className="px-2.5">Tham chiếu</TableHead>
                <TableHead className="px-2.5">Trạng thái</TableHead>
                <TableHead className="px-2.5 text-right">Lần thử</TableHead>
                <TableHead className="px-2.5">Lỗi cuối</TableHead>
                <TableHead className="px-2.5 text-right">Lúc</TableHead>
                <TableHead className="px-2.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_JOBS.map((j) => {
                const s = JOB_STATUS[j.status];
                return (
                  <TableRow key={j.job} className={cn(j.selected && 'bg-secondary/50')}>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                      {j.job}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{j.endpoint}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{j.ref}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {j.attempts}
                    </TableCell>
                    <TableCell className="max-w-64 truncate px-2.5 py-1.5 text-muted-foreground">
                      {j.lastError ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {j.at}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                      {j.canRetry ? (
                        <>
                          <Button variant="outline" size="sm">
                            <RefreshCw aria-hidden />
                            Chạy lại
                          </Button>
                          <span className="text-muted-foreground"> · </span>
                        </>
                      ) : null}
                      <button type="button" className="text-primary hover:underline">
                        Payload
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-2.5 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–13 / 1.204</span>
          <span className="flex items-center gap-1">
            <span className="px-1.5">‹</span>
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-semibold text-primary">
              1
            </span>
            <span className="px-1.5">2</span>
            <span className="px-1.5">3</span>
            <span className="px-1.5">…</span>
            <span className="px-1.5">31</span>
            <span className="px-1.5">›</span>
            <span className="ml-2">40 dòng/trang</span>
          </span>
        </div>
      </section>
    </>
  );
}
