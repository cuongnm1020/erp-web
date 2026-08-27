'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Fragment } from 'react';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

interface AuditRow {
  at: string;
  actor: string;
  action: string;
  actionTone: StatusTone;
  table: string;
  record: string;
  traceId: string;
  ip: string;
  expanded?: boolean;
}

interface DiffLine {
  text: string;
  changed?: 'del' | 'add';
}

const SAMPLE_ROWS: AuditRow[] = [
  {
    at: '2026-08-23T10:14:02+07:00',
    actor: 'Lê Quang Huy',
    action: 'UPDATE',
    actionTone: 'brand',
    table: 'core.Role',
    record: 'sale-leader',
    traceId: 'a4f2-9c1e',
    ip: '10.0.12.52',
  },
  {
    at: '2026-08-23T10:12:47+07:00',
    actor: 'Trần Thị Bình',
    action: 'APPROVE',
    actionTone: 'ok',
    table: 'crm.SalesOrder',
    record: 'SO-2608-01229',
    traceId: 'b71d-03aa',
    ip: '10.0.12.53',
  },
  {
    at: '2026-08-23T10:11:30+07:00',
    actor: 'Hệ thống (worker)',
    action: 'POST',
    actionTone: 'ok',
    table: 'wms.GoodsReceipt',
    record: 'GRN-2608-00087',
    traceId: 'c902-7e1b',
    ip: '10.0.12.57',
  },
  {
    at: '2026-08-23T10:09:58+07:00',
    actor: 'Nguyễn Văn An',
    action: 'CREATE',
    actionTone: 'ok',
    table: 'crm.SalesOrder',
    record: 'SO-2608-01241',
    traceId: 'd318-55f0',
    ip: '10.0.12.53',
  },
  {
    at: '2026-08-23T10:08:21+07:00',
    actor: 'Trịnh Thị Mai (PDA)',
    action: 'UPDATE',
    actionTone: 'brand',
    table: 'wms.Task',
    record: 'TK-2608-00412',
    traceId: 'e77a-1c44',
    ip: '10.0.12.59',
  },
  {
    at: '2026-08-23T10:01:40+07:00',
    actor: 'Lê Quang Huy',
    action: 'UPDATE',
    actionTone: 'brand',
    table: 'core.Customer',
    record: 'KH-004512',
    traceId: '7f3a-2b9c',
    ip: '10.0.12.52',
    expanded: true,
  },
  {
    at: '2026-08-23T09:58:12+07:00',
    actor: 'Đặng Thị Thu',
    action: 'CREATE',
    actionTone: 'ok',
    table: 'fin.Payment',
    record: 'PAY-2608-00214',
    traceId: '1a2b-3c4d',
    ip: '10.0.12.52',
  },
  {
    at: '2026-08-23T09:55:36+07:00',
    actor: 'Đỗ Minh Tuấn',
    action: 'ASSIGN',
    actionTone: 'brand',
    table: 'core.Customer',
    record: 'KH-007781',
    traceId: '2b3c-4d5e',
    ip: '10.0.12.52',
  },
  {
    at: '2026-08-23T09:47:10+07:00',
    actor: 'Vũ Thị Lan',
    action: 'LOGIN',
    actionTone: 'neutral',
    table: 'core.User',
    record: 'lan.vt',
    traceId: '5e6f-7081',
    ip: '10.0.12.50',
  },
  {
    at: '2026-08-23T09:45:55+07:00',
    actor: 'Tạ Văn Kiên',
    action: 'LOCK',
    actionTone: 'warn',
    table: 'fin.Period',
    record: '2026-07',
    traceId: '6f70-8192',
    ip: '10.0.12.51',
  },
  {
    at: '2026-08-23T09:36:27+07:00',
    actor: 'Lê Quang Huy',
    action: 'UPDATE',
    actionTone: 'brand',
    table: 'core.SystemConfig',
    record: 'doc_number.SO',
    traceId: '92a3-b4c5',
    ip: '10.0.12.52',
  },
  {
    at: '2026-08-23T09:25:40+07:00',
    actor: 'Hệ thống (webhook)',
    action: 'FAIL',
    actionTone: 'err',
    table: 'int.WebhookJob',
    record: 'ghn.create_order',
    traceId: 'b4c5-d6e7',
    ip: '10.0.12.58',
  },
  {
    at: '2026-08-23T09:12:33+07:00',
    actor: 'Hệ thống (rule)',
    action: 'FLAG',
    actionTone: 'warn',
    table: 'core.Customer',
    record: 'KH-001203',
    traceId: 'd6e7-f809',
    ip: '10.0.12.55',
  },
  {
    at: '2026-08-23T09:05:51+07:00',
    actor: 'Bùi Thị Hạnh',
    action: 'CREATE',
    actionTone: 'ok',
    table: 'crm.Ticket',
    record: 'TCK-2608-00077',
    traceId: 'e7f8-091a',
    ip: '10.0.12.52',
  },
];

const DIFF_BEFORE: DiffLine[] = [
  { text: '{' },
  { text: '  "code": "KH-004512",' },
  { text: '  "name": "Cửa hàng Minh Tâm",' },
  { text: '  "tier": "BRONZE",', changed: 'del' },
  { text: '  "creditLimit": "30000000.0000",', changed: 'del' },
  { text: '  "ownerUserId": "NV-0003",' },
  { text: '  "teamId": "TEAM-SALE-HN",' },
  { text: '  "priceListId": "PL-RETAIL"', changed: 'del' },
  { text: '}' },
];

const DIFF_AFTER: DiffLine[] = [
  { text: '{' },
  { text: '  "code": "KH-004512",' },
  { text: '  "name": "Cửa hàng Minh Tâm",' },
  { text: '  "tier": "SILVER",', changed: 'add' },
  { text: '  "creditLimit": "50000000.0000",', changed: 'add' },
  { text: '  "ownerUserId": "NV-0003",' },
  { text: '  "teamId": "TEAM-SALE-HN",' },
  { text: '  "priceListId": "PL-DAILY-BAC"', changed: 'add' },
  { text: '}' },
];

function DiffPanel({ title, lines }: { title: string; lines: DiffLine[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-md border bg-background p-2 font-mono text-xs leading-5">
        {lines.map((l) => (
          <div
            key={l.text}
            className={cn(
              'whitespace-pre',
              l.changed === 'del' && 'bg-destructive/10 text-destructive',
              l.changed === 'add' && 'bg-success/10 text-success',
            )}
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

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
      {active ? <span aria-hidden>✕</span> : <ChevronDown className="h-3 w-3" aria-hidden />}
    </button>
  );
}

export function AuditLogScreen() {
  return (
    <>
      <PageHeader
        title="Nhật ký hoạt động"
        description="Chỉ đọc · lưu 24 tháng · 1.284.902 bản ghi"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Hệ thống' }, { label: 'Nhật ký hoạt động' }]}
        actions={<Button variant="outline">Xuất CSV (theo bộ lọc)</Button>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input className="h-7 pl-8 text-xs" placeholder="Người thực hiện…" />
        </div>
        <FilterChip label="Hành động: Tất cả" />
        <FilterChip label="Bảng: core.Customer" active />
        <FilterChip label="23/08/2026 00:00 – 23/08/2026 23:59" active />
        <FilterChip label="traceId" />
        <Button variant="ghost" size="sm">
          Xóa lọc
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          Đã lưu: <span className="font-semibold text-foreground">Sửa khách hàng</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-8 px-2.5" />
              <TableHead className="px-2.5 text-right">Thời gian ↓</TableHead>
              <TableHead className="px-2.5">Người thực hiện</TableHead>
              <TableHead className="px-2.5">Hành động</TableHead>
              <TableHead className="px-2.5">Bảng</TableHead>
              <TableHead className="px-2.5">Bản ghi</TableHead>
              <TableHead className="px-2.5">traceId</TableHead>
              <TableHead className="px-2.5">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_ROWS.map((r) => (
              <Fragment key={r.traceId}>
                <TableRow className={cn(r.expanded && 'bg-secondary/50')}>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.expanded ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatDateTime(r.at, { seconds: true })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">{r.actor}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={r.actionTone}>{r.action}</StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.table}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                    {r.record}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                    {r.traceId}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                    {r.ip}
                  </TableCell>
                </TableRow>
                {r.expanded ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="bg-muted/30 px-4 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <DiffPanel title="Trước" lines={DIFF_BEFORE} />
                        <DiffPanel title="Sau · 3 trường đổi" lines={DIFF_AFTER} />
                        <p className="text-xs text-muted-foreground md:col-span-2">
                          requestId <span className="font-mono">7f3a-2b9c-4e10-88d2</span> · UI
                          /customers/KH-004512 · Chrome 128 · 10.0.12.45 ·{' '}
                          <button type="button" className="text-primary hover:underline">
                            Mở bản ghi
                          </button>{' '}
                          ·{' '}
                          <button type="button" className="text-primary hover:underline">
                            Các thay đổi khác trong request này (2)
                          </button>
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-2.5 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–40 / 3.118</span>
          <span className="flex items-center gap-1">
            <span className="px-1.5">‹</span>
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-semibold text-primary">
              1
            </span>
            <span className="px-1.5">2</span>
            <span className="px-1.5">3</span>
            <span className="px-1.5">…</span>
            <span className="px-1.5">78</span>
            <span className="px-1.5">›</span>
            <span className="ml-2">40 dòng/trang</span>
          </span>
        </div>
      </div>
    </>
  );
}
