'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-4).

import { Clock, MessageSquare, Paperclip, Pencil, Phone, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';

type TimelineKind = 'call' | 'note' | 'reply';

interface TimelineItem {
  kind: TimelineKind;
  internal: boolean;
  title: string;
  body: string;
  meta: string;
  docRefs?: string[];
}

const SAMPLE_TIMELINE: TimelineItem[] = [
  {
    kind: 'call',
    internal: false,
    title: 'Khách gọi đến',
    body: '— chị Tâm báo đơn SO-2308-01102 nhận 4/6 hộp kẹp giấy Plus 50mm, thùng ngoài nguyên vẹn',
    meta: '18/08/2026 09:10 · ghi bởi Nguyễn Văn An · có ghi âm 2:30',
  },
  {
    kind: 'note',
    internal: true,
    title: 'Ghi chú nội bộ',
    body: '— đã đối chiếu phiếu xuất GDN-2608-00214: kho xác nhận pick đủ 6, nghi thiếu từ khâu đóng gói. Nhờ QC kho HN-1 xem camera đóng gói.',
    meta: '18/08/2026 10:30 · Lê Thu Hà',
  },
  {
    kind: 'reply',
    internal: false,
    title: 'Trả lời khách (Zalo)',
    body: '— "Bên em đã tiếp nhận, đang kiểm tra với kho, chậm nhất thứ 2 sẽ giao bù nếu thiếu do kho ạ."',
    meta: '18/08/2026 09:40 · Lê Thu Hà · phản hồi đầu tiên, đúng SLA',
  },
  {
    kind: 'note',
    internal: true,
    title: 'Ghi chú nội bộ',
    body: '— QC xác nhận camera cho thấy chỉ đóng 4 hộp. Thiếu do đóng gói. Đề xuất: giao bù 2 hộp kèm đơn SO-2308-01277 ngày mai.',
    meta: '23/08/2026 16:20 · Đỗ Thanh Tùng (QC kho HN-1)',
  },
];

const DOT_CLASS: Record<TimelineKind, string> = {
  call: 'bg-success/10 text-success',
  note: 'bg-info/10 text-info',
  reply: 'bg-warning/10 text-warning',
};

const RELATED_ORDER = {
  code: 'SO-2308-01102',
  total: '3680000',
  status: 'Đã giao',
  detail: 'Giao 16/08 · phiếu xuất GDN-2608-00214 · dòng lỗi: Kẹp giấy Plus 50mm × 6 hộp',
};

type ConvFilter = 'all' | 'customer' | 'internal';
type ReplyMode = 'customer' | 'internal';

export function TicketDetailScreen({ id }: { id: string }) {
  const [filter, setFilter] = useState<ConvFilter>('all');
  const [replyMode, setReplyMode] = useState<ReplyMode>('customer');

  const items = SAMPLE_TIMELINE.filter((it) => {
    if (filter === 'customer') return !it.internal;
    if (filter === 'internal') return it.internal;
    return true;
  });

  return (
    <>
      <PageHeader
        title={`${id} — Giao thiếu 2 hộp kẹp giấy Plus 50mm`}
        description="Tạo bởi Nguyễn Văn An · 18/08/2026 09:15 · loại: Giao thiếu · ưu tiên: Trung bình"
        breadcrumb={[
          { label: 'Khách hàng' },
          { label: 'Ticket CSKH', href: '/crm/tickets' },
          { label: id },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Chuyển ưu tiên ▾
            </Button>
            <Button variant="outline" size="sm">
              Đóng ticket
            </Button>
            <Button size="sm">Trả lời khách</Button>
          </>
        }
      />

      <div className="mb-3 flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <span className="font-semibold">SLA xử lý còn 5h 10m</span> — hạn 24/08/2026 15:00 (giờ
          làm việc). Người xử lý: Lê Thu Hà · phản hồi đầu đúng hạn lúc 18/08 09:40.
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <section className="flex flex-col rounded-md border bg-card lg:col-span-3">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Trao đổi &amp; ghi chú</span>
            <div className="flex gap-1.5">
              {(
                [
                  { key: 'all', label: 'Tất cả' },
                  { key: 'customer', label: 'Với khách' },
                  { key: 'internal', label: 'Nội bộ' },
                ] as { key: ConvFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'flex h-6 items-center rounded-md border border-input bg-background px-2 text-xs',
                    filter === f.key && 'border-primary bg-secondary font-semibold text-primary',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 px-3 py-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2.5 border-b py-2 last:border-0">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                    DOT_CLASS[it.kind],
                  )}
                >
                  {it.kind === 'call' ? (
                    <Phone className="h-3 w-3" />
                  ) : it.kind === 'reply' ? (
                    <MessageSquare className="h-3 w-3" />
                  ) : (
                    <Pencil className="h-3 w-3" />
                  )}
                </span>
                <div className="min-w-0 text-sm">
                  <div>
                    <span className="font-semibold">{it.title}</span>{' '}
                    {it.internal ? <StatusBadge tone="neutral">nội bộ</StatusBadge> : null}{' '}
                    {it.body}
                  </div>
                  <div className="text-xs text-muted-foreground">{it.meta}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 border-t px-3 py-2">
            <div className="flex" role="tablist" aria-label="Kiểu phản hồi">
              {(
                [
                  { key: 'customer', label: 'Trả lời khách' },
                  { key: 'internal', label: 'Ghi chú nội bộ' },
                ] as { key: ReplyMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={replyMode === m.key}
                  onClick={() => setReplyMode(m.key)}
                  className={cn(
                    'border-b-2 border-transparent px-3 py-1 text-sm text-muted-foreground',
                    replyMode === m.key && 'border-primary font-semibold text-primary',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <textarea
              className="min-h-14 w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground"
              placeholder={
                replyMode === 'customer'
                  ? 'Nhập nội dung trả lời… Zalo là kênh khách đang dùng. Ctrl+Enter để gửi'
                  : 'Nhập ghi chú nội bộ… khách không thấy nội dung này'
              }
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-6 items-center rounded-md border border-input bg-background px-2 text-xs"
              >
                Mẫu: xin lỗi giao thiếu ▾
              </button>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" className="h-7">
                  <Paperclip />
                  Đính kèm
                </Button>
                <Button size="sm" className="h-7">
                  <Send />
                  Gửi
                  <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
                    Ctrl ↵
                  </kbd>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-2.5 lg:col-span-2">
          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
              <span>Khách hàng</span>
              <Link href="#" className="font-normal text-primary hover:underline">
                Mở hồ sơ 360°
              </Link>
            </div>
            <div className="flex flex-col gap-1.5 px-2.5 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                  MT
                </span>
                <div className="min-w-0">
                  <div className="font-semibold">
                    Cửa hàng Minh Tâm <StatusBadge tone="neutral">Bạc</StatusBadge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">KH-004512</span> · 0912 345 678 · phụ trách Nguyễn
                    Văn An
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                1 ticket đang mở · 2 ticket đã đóng trong 12 tháng
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <div className="border-b px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
              Đơn liên quan
            </div>
            <div className="flex flex-col gap-1.5 px-2.5 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Link href="#" className="font-mono text-xs text-primary hover:underline">
                  {RELATED_ORDER.code}
                </Link>
                <span className="ml-auto text-right font-semibold tabular-nums">
                  {formatMoney(RELATED_ORDER.total)}
                </span>
                <StatusBadge tone="ok">{RELATED_ORDER.status}</StatusBadge>
              </div>
              <div className="text-xs text-muted-foreground">{RELATED_ORDER.detail}</div>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <div className="border-b px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
              Xử lý
            </div>
            <div className="flex flex-col gap-2 px-2.5 py-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Người xử lý</span>
                <button
                  type="button"
                  className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                    LH
                  </span>
                  Lê Thu Hà
                  <span className="ml-auto text-muted-foreground">▾</span>
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Trạng thái</span>
                <button
                  type="button"
                  className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <StatusBadge tone="warn">Đang xử lý</StatusBadge>
                  <span className="ml-auto text-muted-foreground">▾</span>
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Loại · ưu tiên</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex h-8 flex-1 items-center rounded-md border border-input bg-background px-2 text-sm"
                  >
                    Giao thiếu
                    <span className="ml-auto text-muted-foreground">▾</span>
                  </button>
                  <button
                    type="button"
                    className="flex h-8 flex-1 items-center rounded-md border border-input bg-background px-2 text-sm"
                  >
                    Trung bình
                    <span className="ml-auto text-muted-foreground">▾</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <div className="border-b px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
              Hướng giải quyết
            </div>
            <div className="flex flex-col gap-1.5 px-2.5 py-2 text-sm">
              <Link href="#" className="text-primary hover:underline">
                Tạo phiếu giao bù (2 hộp, kèm SO-2308-01277)
              </Link>
              <Link href="#" className="text-primary hover:underline">
                Tạo phiếu RMA / đổi trả
              </Link>
              <Link href="#" className="text-primary hover:underline">
                Tạo phiếu điều chỉnh tồn kho (lý do: thiếu khi đóng gói)
              </Link>
              <div className="text-xs text-muted-foreground">
                Phiếu tạo từ đây tự link ngược về {id}.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
