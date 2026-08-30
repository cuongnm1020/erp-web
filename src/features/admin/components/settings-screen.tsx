'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Lock } from 'lucide-react';
import { RowActions } from '@/components/data/row-actions';
import { StatusBadge } from '@/components/data/status-badge';
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
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';

interface DocSequenceRow {
  docType: string;
  prefix: string;
  format: string;
  current: string;
  resetBy: 'Tháng' | 'Năm';
  period: string;
}

interface PeriodRow {
  period: string;
  range: string;
  status: 'open' | 'locked';
  lockedBy: string | null;
}

const CONFIG_TABS = [
  'Chung',
  'Dải số chứng từ',
  'Kỳ kế toán',
  'Kênh thông báo',
  'Đơn vị vận chuyển',
  'Cổng thanh toán',
];

const SAMPLE_SEQUENCES: DocSequenceRow[] = [
  {
    docType: 'Đơn bán hàng',
    prefix: 'SO',
    format: 'SO-{YYMM}-{00000}',
    current: '01241',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Phiếu nhập kho',
    prefix: 'GRN',
    format: 'GRN-{YYMM}-{00000}',
    current: '00087',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Phiếu xuất kho',
    prefix: 'GDN',
    format: 'GDN-{YYMM}-{00000}',
    current: '01133',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Đơn mua hàng',
    prefix: 'PO',
    format: 'PO-{YYMM}-{00000}',
    current: '00031',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Hóa đơn',
    prefix: 'INV',
    format: 'INV-{YYYY}-{000000}',
    current: '004218',
    resetBy: 'Năm',
    period: '2026',
  },
  {
    docType: 'Phiếu thu',
    prefix: 'PAY',
    format: 'PAY-{YYMM}-{00000}',
    current: '00214',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Task kho',
    prefix: 'TK',
    format: 'TK-{YYMM}-{00000}',
    current: '00412',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Phiếu kiểm kê',
    prefix: 'CNT',
    format: 'CNT-{YYMM}-{000}',
    current: '004',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Điều chỉnh tồn',
    prefix: 'ADJ',
    format: 'ADJ-{YYMM}-{0000}',
    current: '0012',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Chuyển kho',
    prefix: 'TRF',
    format: 'TRF-{YYMM}-{0000}',
    current: '0041',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Ticket CSKH',
    prefix: 'TCK',
    format: 'TCK-{YYMM}-{00000}',
    current: '00077',
    resetBy: 'Tháng',
    period: '2026-08',
  },
  {
    docType: 'Đơn hoàn',
    prefix: 'RMA',
    format: 'RMA-{YYMM}-{0000}',
    current: '0008',
    resetBy: 'Tháng',
    period: '2026-08',
  },
];

const SAMPLE_PERIODS: PeriodRow[] = [
  { period: '2026-08', range: '01/08/2026 – 31/08/2026', status: 'open', lockedBy: null },
  {
    period: '2026-07',
    range: '01/07/2026 – 31/07/2026',
    status: 'locked',
    lockedBy: 'Tạ Văn Kiên · 23/08/2026 09:45',
  },
  {
    period: '2026-06',
    range: '01/06/2026 – 30/06/2026',
    status: 'locked',
    lockedBy: 'Tạ Văn Kiên · 08/07/2026',
  },
  {
    period: '2026-05',
    range: '01/05/2026 – 31/05/2026',
    status: 'locked',
    lockedBy: 'Tạ Văn Kiên · 06/06/2026',
  },
  {
    period: '2026-04',
    range: '01/04/2026 – 30/04/2026',
    status: 'locked',
    lockedBy: 'Tạ Văn Kiên · 07/05/2026',
  },
  {
    period: '2026-03',
    range: '01/03/2026 – 31/03/2026',
    status: 'locked',
    lockedBy: 'Đặng Thị Thu · 05/04/2026',
  },
];

export function SettingsScreen() {
  return (
    <>
      <PageHeader
        title="Cấu hình hệ thống"
        description="Thay đổi có hiệu lực ngay, được ghi vào nhật ký hoạt động"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Hệ thống' }, { label: 'Cấu hình' }]}
        actions={
          <>
            <Button variant="ghost">Hoàn tác</Button>
            <Button disabled>Lưu thay đổi</Button>
          </>
        }
      />
      <div className="grid items-start gap-3 lg:grid-cols-[220px_1fr]">
        <nav className="rounded-md border bg-card p-2">
          {CONFIG_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                'block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted',
                tab === 'Dải số chứng từ' && 'bg-secondary font-semibold text-primary',
              )}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="space-y-3">
          <section className="rounded-md border bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-3 py-2">
              <h2 className="text-sm font-semibold">Dải số chứng từ</h2>
              <span className="text-xs text-muted-foreground">
                Số cấp bởi server lúc lưu (core.next_doc_number) · không sửa được số hiện tại
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="px-2.5">Loại chứng từ</TableHead>
                    <TableHead className="px-2.5">Tiền tố</TableHead>
                    <TableHead className="px-2.5">Định dạng</TableHead>
                    <TableHead className="px-2.5 text-right">Số hiện tại</TableHead>
                    <TableHead className="px-2.5">Reset theo</TableHead>
                    <TableHead className="px-2.5">Kỳ hiện tại</TableHead>
                    <TableHead className="w-11 px-2.5">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_SEQUENCES.map((s) => (
                    <TableRow key={s.prefix}>
                      <TableCell className="px-2.5 py-1.5 font-semibold">{s.docType}</TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{s.prefix}</TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{s.format}</TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right font-mono text-xs tabular-nums">
                        {s.current}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">{s.resetBy}</TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                        {s.period}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <RowActions
                          onEdit={() => toast.info('UI-first — form sửa dải số chưa nối API')}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">Kỳ kế toán</h2>
              <button type="button" className="text-sm text-primary hover:underline">
                Xem tất cả 32 kỳ
              </button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="px-2.5">Kỳ</TableHead>
                    <TableHead className="px-2.5">Khoảng</TableHead>
                    <TableHead className="px-2.5">Trạng thái</TableHead>
                    <TableHead className="px-2.5">Khóa bởi</TableHead>
                    <TableHead className="px-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_PERIODS.map((p) => (
                    <TableRow key={p.period}>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs font-semibold">
                        {p.period}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                        {p.range}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {p.status === 'open' ? (
                          <StatusBadge tone="ok">Đang mở</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Đã khóa</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                        {p.lockedBy ?? '—'}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {p.status === 'open' ? (
                          <button type="button" className="text-primary hover:underline">
                            Khóa kỳ
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Mở lại cần quyền kế toán trưởng
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border-t p-3">
              <div className="flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Kỳ đã khóa: không post chứng từ tài chính, không ghi lùi ngày nhập/xuất kho vào kỳ
                  đó. Chứng từ nghiệp vụ đã post vẫn bất biến bất kể kỳ.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
