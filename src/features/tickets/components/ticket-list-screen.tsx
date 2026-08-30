'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-4).

import { Download, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RowActions } from '@/components/data/row-actions';
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

type TicketPriority = 'high' | 'medium' | 'low';
type TicketStatus = 'new' | 'processing' | 'waiting' | 'done';
type SlaState = { kind: 'ok' | 'warn' | 'over'; label: string } | { kind: 'done'; label: string };

interface TicketRow {
  code: string;
  customer: string;
  title: string;
  type: string;
  priority: TicketPriority;
  assignee: string | null;
  sla: SlaState;
  status: TicketStatus;
  updatedAt: string;
}

const CURRENT_USER = 'Nguyễn Văn An';

const PRIORITY_LABEL: Record<TicketPriority, { tone: StatusTone; label: string }> = {
  high: { tone: 'err', label: 'Cao' },
  medium: { tone: 'warn', label: 'Trung bình' },
  low: { tone: 'neutral', label: 'Thấp' },
};

const STATUS_LABEL: Record<TicketStatus, { tone: StatusTone; label: string }> = {
  new: { tone: 'brand', label: 'Mới' },
  processing: { tone: 'warn', label: 'Đang xử lý' },
  waiting: { tone: 'warn', label: 'Chờ khách' },
  done: { tone: 'ok', label: 'Đã xong' },
};

const SLA_CLASS: Record<'ok' | 'warn' | 'over', string> = {
  ok: 'text-success font-semibold',
  warn: 'text-warning font-semibold',
  over: 'text-destructive font-semibold',
};

const SAMPLE_TICKETS: TicketRow[] = [
  {
    code: 'TK-0244',
    customer: 'Công ty CP Đầu tư Thành Công',
    title: 'Hàng giao vỡ 3 hộp mực in Canon 325',
    type: 'Hàng lỗi',
    priority: 'high',
    assignee: 'Nguyễn Văn An',
    sla: { kind: 'over', label: 'Quá hạn 1h 20m' },
    status: 'processing',
    updatedAt: '2026-08-24T09:05:00+07:00',
  },
  {
    code: 'TK-0243',
    customer: 'Nhà sách Fahasa Long Biên',
    title: 'Yêu cầu đổi 20 cuốn sổ Campus A5 bị lem bìa sang lô mới',
    type: 'Đổi/trả',
    priority: 'high',
    assignee: 'Nguyễn Văn An',
    sla: { kind: 'warn', label: 'Còn 1h 40m' },
    status: 'new',
    updatedAt: '2026-08-24T08:40:00+07:00',
  },
  {
    code: 'TK-0231',
    customer: 'Cửa hàng Minh Tâm',
    title: 'Giao thiếu 2 hộp kẹp giấy Plus 50mm',
    type: 'Giao thiếu',
    priority: 'medium',
    assignee: 'Nguyễn Văn An',
    sla: { kind: 'ok', label: 'Còn 5h 10m' },
    status: 'processing',
    updatedAt: '2026-08-23T16:20:00+07:00',
  },
  {
    code: 'TK-0242',
    customer: 'Văn phòng phẩm Hồng Hà Cầu Giấy',
    title: 'Hỏi tiến độ đơn SO-2308-01301 đang bị chặn công nợ',
    type: 'Hỏi đáp',
    priority: 'medium',
    assignee: null,
    sla: { kind: 'warn', label: 'Còn 2h 05m' },
    status: 'new',
    updatedAt: '2026-08-24T08:15:00+07:00',
  },
  {
    code: 'TK-0241',
    customer: 'Trường THCS Nguyễn Du',
    title: 'Xin báo giá 500 bộ dụng cụ học sinh cho khai giảng',
    type: 'Hỏi đáp',
    priority: 'low',
    assignee: null,
    sla: { kind: 'ok', label: 'Còn 18h' },
    status: 'new',
    updatedAt: '2026-08-24T07:58:00+07:00',
  },
  {
    code: 'TK-0240',
    customer: 'Tiệm photocopy Quang Minh',
    title: 'Mực in Brother TN-2385 nghi hàng không chính hãng',
    type: 'Hàng lỗi',
    priority: 'high',
    assignee: 'Lê Thu Hà',
    sla: { kind: 'ok', label: 'Còn 3h 30m' },
    status: 'processing',
    updatedAt: '2026-08-23T17:44:00+07:00',
  },
  {
    code: 'TK-0239',
    customer: 'Công ty TNHH Hòa Phát Văn Phòng Phẩm',
    title: 'Sai đơn giá bảng giá đại lý trên hóa đơn INV-2608-00302',
    type: 'Hóa đơn',
    priority: 'medium',
    assignee: 'Lê Thu Hà',
    sla: { kind: 'ok', label: 'Còn 6h 15m' },
    status: 'processing',
    updatedAt: '2026-08-23T15:02:00+07:00',
  },
  {
    code: 'TK-0238',
    customer: 'Cửa hàng Sao Mai',
    title: 'Xin xuất lại hóa đơn VAT do sai tên công ty',
    type: 'Hóa đơn',
    priority: 'low',
    assignee: null,
    sla: { kind: 'ok', label: 'Còn 20h' },
    status: 'new',
    updatedAt: '2026-08-23T14:30:00+07:00',
  },
  {
    code: 'TK-0237',
    customer: 'Công ty CP Tư vấn Xây dựng Bắc Hà',
    title: 'Giao chậm đơn SO-2308-01188 quá 2 ngày so với hẹn',
    type: 'Giao chậm',
    priority: 'high',
    assignee: 'Đỗ Thanh Tùng',
    sla: { kind: 'over', label: 'Quá hạn 30m' },
    status: 'processing',
    updatedAt: '2026-08-23T11:12:00+07:00',
  },
  {
    code: 'TK-0236',
    customer: 'Trung tâm Anh ngữ Bright Kids',
    title: 'Đề nghị hỗ trợ in tem nhãn cho bộ quà tặng học viên',
    type: 'Hỏi đáp',
    priority: 'low',
    assignee: 'Vũ Ngọc Huyền',
    sla: { kind: 'ok', label: 'Còn 22h' },
    status: 'new',
    updatedAt: '2026-08-23T10:05:00+07:00',
  },
  {
    code: 'TK-0235',
    customer: 'Nhà sách Tiền Phong',
    title: 'Trả 5 ream giấy A4 Double A bị ẩm, yêu cầu tạo RMA',
    type: 'Đổi/trả',
    priority: 'medium',
    assignee: 'Lê Thu Hà',
    sla: { kind: 'ok', label: 'Còn 7h' },
    status: 'waiting',
    updatedAt: '2026-08-23T09:48:00+07:00',
  },
  {
    code: 'TK-0234',
    customer: 'Cửa hàng Ngọc Lan',
    title: 'Hỏi chương trình khuyến mãi mùa tựu trường tháng 9',
    type: 'Hỏi đáp',
    priority: 'low',
    assignee: null,
    sla: { kind: 'ok', label: 'Còn 23h' },
    status: 'new',
    updatedAt: '2026-08-23T09:20:00+07:00',
  },
  {
    code: 'TK-0233',
    customer: 'Công ty TNHH Kế toán An Phát',
    title: 'Đối chiếu công nợ tháng 7 lệch 1.850.000',
    type: 'Công nợ',
    priority: 'medium',
    assignee: 'Đỗ Thanh Tùng',
    sla: { kind: 'ok', label: 'Còn 4h 50m' },
    status: 'processing',
    updatedAt: '2026-08-23T08:30:00+07:00',
  },
  {
    code: 'TK-0232',
    customer: 'Trường Tiểu học Kim Liên',
    title: 'Xin giấy chứng nhận xuất xứ cho lô bút màu',
    type: 'Hỏi đáp',
    priority: 'low',
    assignee: null,
    sla: { kind: 'ok', label: 'Còn 26h' },
    status: 'new',
    updatedAt: '2026-08-22T17:10:00+07:00',
  },
  {
    code: 'TK-0229',
    customer: 'Cửa hàng Bảo Châu',
    title: 'Hỏi giá sỉ sổ lò xo Klong A4 cho đơn 300 cuốn',
    type: 'Hỏi đáp',
    priority: 'low',
    assignee: 'Nguyễn Văn An',
    sla: { kind: 'done', label: 'Đã phản hồi' },
    status: 'done',
    updatedAt: '2026-08-22T14:12:00+07:00',
  },
];

type TabKey = 'mine' | 'unassigned' | 'all';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mine', label: 'Của tôi' },
  { key: 'unassigned', label: 'Chưa gán' },
  { key: 'all', label: 'Tất cả' },
];

function rowsForTab(tab: TabKey): TicketRow[] {
  if (tab === 'mine') {
    return SAMPLE_TICKETS.filter((t) => t.assignee === CURRENT_USER && t.status !== 'done');
  }
  if (tab === 'unassigned') return SAMPLE_TICKETS.filter((t) => t.assignee === null);
  return SAMPLE_TICKETS;
}

export function TicketListScreen() {
  const [tab, setTab] = useState<TabKey>('all');
  const rows = rowsForTab(tab);

  return (
    <>
      <PageHeader
        title="Ticket CSKH"
        description="SLA phản hồi: Cao 4h · Trung bình 8h · Thấp 24h (giờ làm việc)"
        breadcrumb={[{ label: 'Khách hàng' }, { label: 'Ticket CSKH' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download />
              Xuất CSV
            </Button>
            <Button size="sm">
              <Plus />
              Tạo ticket
              <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
                N
              </kbd>
            </Button>
          </>
        }
      />

      <div className="mb-3 flex border-b" role="tablist" aria-label="Phạm vi ticket">
        {TABS.map((t) => {
          const count = rowsForTab(t.key).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground',
                active && 'border-primary font-semibold text-primary',
              )}
            >
              {t.label}
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 pl-8" placeholder="Tìm mã ticket, khách, tiêu đề…" />
        </div>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md border border-primary bg-secondary px-2 text-sm font-semibold text-primary"
        >
          Trạng thái: Đang mở <span className="text-xs">✕</span>
        </button>
        <button
          type="button"
          className="flex h-8 items-center rounded-md border border-input bg-background px-2 text-sm"
        >
          Loại ▾
        </button>
        <button
          type="button"
          className="flex h-8 items-center rounded-md border border-input bg-background px-2 text-sm"
        >
          Ưu tiên ▾
        </button>
        <button
          type="button"
          className="flex h-8 items-center rounded-md border border-input bg-background px-2 text-sm"
        >
          Người xử lý ▾
        </button>
        <button
          type="button"
          className="flex h-8 items-center rounded-md border border-dashed border-input bg-background px-2 text-sm text-muted-foreground"
        >
          + Lọc
        </button>
        <span className="ml-auto text-xs text-muted-foreground">Sắp xếp: SLA còn ít nhất ▾</span>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="h-8 px-2.5 text-xs">Mã</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">Khách hàng</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">Tiêu đề</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">Loại</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">Ưu tiên</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">Người xử lý</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">SLA còn lại</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">Trạng thái</TableHead>
              <TableHead className="h-8 px-2.5 text-xs">Cập nhật</TableHead>
              <TableHead className="h-8 w-11 px-2.5 text-xs">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const prio = PRIORITY_LABEL[t.priority];
              const st = STATUS_LABEL[t.status];
              return (
                <TableRow key={t.code}>
                  <TableCell className="whitespace-nowrap px-2.5 py-1.5 font-mono text-xs">
                    <Link href={`/crm/tickets/${t.code}`} className="text-primary hover:underline">
                      {t.code}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-52 truncate px-2.5 py-1.5">{t.customer}</TableCell>
                  <TableCell className="max-w-80 truncate px-2.5 py-1.5">{t.title}</TableCell>
                  <TableCell className="whitespace-nowrap px-2.5 py-1.5">{t.type}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={prio.tone}>{prio.label}</StatusBadge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                    {t.assignee ?? <span className="text-muted-foreground">— chưa gán</span>}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap px-2.5 py-1.5',
                      t.sla.kind === 'done' ? 'text-muted-foreground' : SLA_CLASS[t.sla.kind],
                    )}
                  >
                    {t.sla.label}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
                    {formatDateTime(t.updatedAt)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <RowActions editHref={`/crm/tickets/${t.code}`} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Đang hiện {rows.length} ticket đang mở và mới đóng</span>
          <div className="ml-auto flex items-center gap-2">
            <span>40 dòng/trang ▾</span>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled>
              ← Trước
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              Tiếp →
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
