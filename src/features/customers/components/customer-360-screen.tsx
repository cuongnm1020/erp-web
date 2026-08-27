'use client';

import { Info, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { DetailSkeleton, EmptyState, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/errors';
import { formatDate, formatDateTime, formatMoney, formatPhone } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { customerKeys, useCustomer, type Customer } from '../api/use-customers';
import { customerTypeLabel, customerTypeTone, initialsOf } from '../labels';

/**
 * B-02 Hồ sơ khách hàng 360 — GET /customers/{id}.
 *
 * Hiện chỉ dựng phần hồ sơ vì đó là toàn bộ những gì API mô tả được: `CustomerDto` là DTO
 * DUY NHẤT có kiểu response trong openapi.json. Các mảng còn lại của màn 360 theo thiết kế
 * (dòng thời gian hoạt động, đơn gần đây, công nợ theo tuổi nợ, ticket đang mở, địa chỉ giao,
 * đồng ý nhận marketing) chưa có endpoint hoặc chưa có DTO response — xem `MISSING` bên dưới.
 * Luật 2 cấm tự khai shape ở frontend, nên chỗ đó nói thẳng là chưa có dữ liệu thay vì
 * hiển thị số bịa cạnh tên khách thật.
 */
const MISSING: Array<{ title: string; need: string }> = [
  { title: 'Dòng thời gian hoạt động', need: 'chưa có endpoint hoạt động / ghi chú khách hàng' },
  { title: 'Đơn gần đây', need: 'GET /sales-orders chưa khai báo kiểu response' },
  { title: 'Công nợ theo tuổi nợ', need: 'chưa có endpoint công nợ theo khách' },
  { title: 'Ticket đang mở', need: 'chưa có module ticket' },
  { title: 'Địa chỉ giao', need: 'CustomerDto chưa trả danh sách địa chỉ' },
  { title: 'Đồng ý nhận marketing', need: 'GET /notifications/consents chưa khai báo kiểu' },
];

function Card({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={className ? `rounded-md border bg-card ${className}` : 'rounded-md border bg-card'}
    >
      <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
        <span>{title}</span>
        {action}
      </header>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Profile({ c }: { c: Customer }) {
  return (
    <>
      <section className="flex items-center gap-4 rounded-md border bg-card px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">
          {initialsOf(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold leading-tight">{c.name}</h1>
            <StatusBadge tone={customerTypeTone(c.type)}>{customerTypeLabel(c.type)}</StatusBadge>
            {c.isActive ? (
              <StatusBadge tone="ok">Hoạt động</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Ngừng giao dịch</StatusBadge>
            )}
            {c.mergedIntoId ? <StatusBadge tone="warn">Đã gộp</StatusBadge> : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            <span className="font-mono text-xs">{c.code}</span>
            {' · '}
            <span className="font-mono text-xs">{formatPhone(c.phone)}</span>
            {' · '}
            {c.email ?? 'chưa có email'}
            {' · '}
            Khách từ {formatDate(c.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Can I="update" a="Customer">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/crm/customers/${c.id}/edit`}>
                <Pencil aria-hidden />
                Sửa hồ sơ
              </Link>
            </Button>
          </Can>
          <Can I="create" a="SalesOrder">
            <Button size="sm" asChild>
              <Link href={`/crm/orders/new?customerId=${c.id}`}>
                <Plus aria-hidden />
                Tạo đơn
              </Link>
            </Button>
          </Can>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Hạn mức công nợ"
          value={formatMoney(c.creditLimit, { unit: '' })}
          detail={c.creditLimit === null ? 'chưa đặt hạn mức' : 'đơn vị: đồng'}
        />
        <KpiCard
          label="Hạn thanh toán"
          value={c.paymentTerm === null ? '—' : `${c.paymentTerm} ngày`}
          detail={c.paymentTerm === null ? 'theo mặc định của nhóm' : 'kể từ ngày xuất hóa đơn'}
        />
        <KpiCard
          label="Team chăm sóc"
          value={String(c.teamIds.length)}
          detail={c.teamIds.length === 0 ? 'chưa phân team' : 'team đang được phân'}
        />
        <KpiCard
          label="Nhân viên phụ trách"
          value={String(c.ownerIds.length)}
          detail={c.ownerIds.length === 0 ? 'chưa có ai phụ trách' : 'người đang phụ trách'}
        />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Thông tin hồ sơ">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 py-3 sm:grid-cols-3">
            <Field label="Mã khách hàng">
              <span className="font-mono text-xs">{c.code}</span>
            </Field>
            <Field label="Mã số thuế">
              <span className="font-mono text-xs">{c.taxCode ?? '—'}</span>
            </Field>
            <Field label="Loại khách">{customerTypeLabel(c.type)}</Field>
            <Field label="Điện thoại">
              <span className="font-mono text-xs">{formatPhone(c.phone)}</span>
            </Field>
            <Field label="Email">{c.email ?? '—'}</Field>
            <Field label="Bảng giá riêng">
              {c.priceListId ? 'có bảng giá riêng' : 'theo bảng giá chung'}
            </Field>
            <Field label="Nhóm khách">{c.groupId ? 'đã xếp nhóm' : 'chưa xếp nhóm'}</Field>
            <Field label="Cấp độ">{c.tierId ? 'đã xếp cấp độ' : 'chưa xếp cấp độ'}</Field>
            <Field label="Cập nhật gần nhất">{formatDateTime(c.updatedAt)}</Field>
          </dl>
        </Card>

        <Card
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              Chưa nối được
            </span>
          }
        >
          <ul className="flex flex-col gap-2 px-3 py-3 text-sm">
            {MISSING.map((m) => (
              <li key={m.title} className="flex flex-col">
                <span className="font-medium">{m.title}</span>
                <span className="text-xs text-muted-foreground">{m.need}</span>
              </li>
            ))}
          </ul>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Luật 2: shape response phải sinh từ OpenAPI của apps/api. Khi backend khai báo DTO cho
            các endpoint trên thì các thẻ này nối được ngay, không cần sửa gì ở màn hình.
          </p>
        </Card>
      </div>
    </>
  );
}

export function Customer360Screen({ id }: { id: string }) {
  const query = useCustomer(id);
  useInvalidateOn('customer.updated', [customerKeys.detail(id)], {
    filter: (p) => typeof p === 'object' && p !== null && (p as { id?: unknown }).id === id,
  });

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        items={[
          { label: 'Khách hàng', href: '/crm/customers' },
          { label: 'Danh sách', href: '/crm/customers' },
          { label: query.data?.name ?? 'Hồ sơ' },
        ]}
      />
      {isApiError(query.error) && query.error.isNotFound ? (
        <EmptyState
          title="Không tìm thấy khách hàng"
          description="Khách này có thể đã bị gộp, hoặc đang do người khác phụ trách."
          action={
            <Button variant="outline" asChild>
              <Link href="/crm/customers">Về danh sách khách hàng</Link>
            </Button>
          }
        />
      ) : (
        <QueryState query={query} skeleton={<DetailSkeleton fields={9} />}>
          {(c) => <Profile c={c} />}
        </QueryState>
      )}
    </div>
  );
}
