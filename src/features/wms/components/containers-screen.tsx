'use client';

import { Box, Printer, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DetailSkeleton, EmptyState, QueryState } from '@/components/data/states';
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
import { formatDateTime, formatQuantity } from '@/lib/format';
import { usePrint } from '@/lib/print';
import {
  useContainerByBarcode,
  useContainerHistory,
  type ContainerDetail,
} from '../api/use-containers';
import { LpnPrintSheet } from './lpn-label';

const STATUS: Record<ContainerDetail['status'], { label: string; tone: StatusTone }> = {
  OPEN: { label: 'Đang chứa hàng', tone: 'ok' },
  PICKED: { label: 'Đã lấy (chờ đóng gói)', tone: 'brand' },
  EMPTY: { label: 'Rỗng', tone: 'neutral' },
  CLOSED: { label: 'Đã đóng', tone: 'draft' },
};

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: '+ Nhập',
  PUT_AWAY: 'Cất hàng',
  TRANSFER: 'Chuyển',
  PICK: '− Xuất (đóng gói)',
  REPACK: 'Tách / gộp',
  ADJUSTMENT: 'Điều chỉnh',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function History({ id }: { id: string }) {
  const q = useContainerHistory(id);
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <header className="border-b px-3 py-2 text-sm font-semibold">Lịch sử (cả cây)</header>
      <QueryState
        query={q}
        skeleton={<DetailSkeleton />}
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState title="Chưa có chuyển động nào" className="py-6" />}
      >
        {(rows) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-2.5 text-xs">Thời gian</TableHead>
                  <TableHead className="px-2.5 text-xs">Loại</TableHead>
                  <TableHead className="px-2.5 text-xs">Thùng</TableHead>
                  <TableHead className="px-2.5 text-xs">SKU</TableHead>
                  <TableHead className="px-2.5 text-xs">Vị trí</TableHead>
                  <TableHead className="px-2.5 text-right text-xs">+/− SL</TableHead>
                  <TableHead className="px-2.5 text-xs">Chứng từ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.movementId}>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {MOVEMENT_LABEL[m.movementType] ?? m.movementType}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {m.containerBarcode}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{m.skuCode}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {m.locationCode}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {formatQuantity(m.qtyDelta)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-xs text-muted-foreground">
                      {m.refType ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
    </section>
  );
}

function Detail({ c }: { c: ContainerDetail }) {
  const printer = usePrint();
  const st = STATUS[c.status];
  const label = {
    barcode: c.barcode,
    typeCode: c.typeCode,
    line1: c.contents[0]
      ? `${c.contents[0].skuCode} × ${formatQuantity(c.contents[0].onHand)}`
      : `${c.childCount} thùng con`,
    line2: c.contents[0]?.skuName ?? '',
  };
  return (
    <div className="flex flex-col gap-3">
      <LpnPrintSheet labels={[label]} printer={printer} />
      <div className="flex items-center gap-2">
        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
        {c.ancestors.length ? (
          <span className="text-sm text-muted-foreground">
            Nằm trong{' '}
            {c.ancestors.map((a, i) => (
              <span key={a.id}>
                {i > 0 ? ' ← ' : ''}
                <Link
                  href={`/wms/containers?code=${encodeURIComponent(a.barcode)}`}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {a.barcode}
                </Link>{' '}
                <span className="text-xs">({a.typeCode})</span>
              </span>
            ))}
          </span>
        ) : null}
        <Button variant="outline" size="sm" className="ml-auto" onClick={printer.print}>
          <Printer aria-hidden />
          In tem
        </Button>
      </div>

      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-4">
        <Field label="Mã thùng">
          <span className="font-mono font-semibold">{c.barcode}</span>
        </Field>
        <Field label="Loại">
          {c.typeName} <span className="font-mono text-xs">({c.typeCode})</span>
        </Field>
        <Field label="Vị trí">
          <span className="font-mono">{c.locationCode}</span>
        </Field>
        <Field label="Tồn trong cây">
          <b className="tabular-nums">{formatQuantity(c.onHand)}</b>
          <span className="text-muted-foreground"> · giữ chỗ {formatQuantity(c.reserved)}</span>
        </Field>
        <Field label="Thùng con">{c.childCount}</Field>
        <Field label="Nguồn">{c.refType ?? '—'}</Field>
        <Field label="Tạo lúc">{formatDateTime(c.createdAt)}</Field>
        <Field label="Đóng lúc">{c.closedAt ? formatDateTime(c.closedAt) : '—'}</Field>
      </div>

      <section className="overflow-hidden rounded-md border bg-card">
        <header className="border-b px-3 py-2 text-sm font-semibold">
          Hàng bên trong (gộp cả thùng con) · {c.contents.length} SKU
        </header>
        {c.contents.length === 0 ? (
          <EmptyState title="Thùng rỗng" className="py-6" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="px-2.5 text-xs">SKU</TableHead>
                <TableHead className="px-2.5 text-xs">Lô</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Tồn</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Giữ chỗ</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Khả dụng</TableHead>
                <TableHead className="px-2.5 text-right text-xs">
                  Trực tiếp trong thùng này
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.contents.map((x) => (
                <TableRow key={`${x.skuId}|${x.lotId ?? ''}`}>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="font-semibold">{x.skuName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{x.skuCode}</div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                    {x.lotNumber ?? '—'}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatQuantity(x.onHand)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatQuantity(x.reserved)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums font-semibold">
                    {formatQuantity(x.available)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatQuantity(x.onHandDirect)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {c.children.length ? (
        <section className="overflow-hidden rounded-md border bg-card">
          <header className="border-b px-3 py-2 text-sm font-semibold">
            Thùng con · {c.children.length}
          </header>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="px-2.5 text-xs">Mã</TableHead>
                <TableHead className="px-2.5 text-xs">Loại</TableHead>
                <TableHead className="px-2.5 text-xs">Trạng thái</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Tồn</TableHead>
                <TableHead className="px-2.5 text-right text-xs">Thùng con</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.children.map((ch) => (
                <TableRow key={ch.id}>
                  <TableCell className="px-2.5 py-1.5 font-mono">
                    <Link
                      href={`/wms/containers?code=${encodeURIComponent(ch.barcode)}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {ch.barcode}
                    </Link>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">{ch.typeCode}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={STATUS[ch.status].tone}>
                      {STATUS[ch.status].label}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatQuantity(ch.onHand)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {ch.childCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <History id={c.id} />
    </div>
  );
}

/**
 * Tra cứu thùng / kiện / pallet theo mã tem (PLAN-packaging-hierarchy C): cây cha–con, hàng bên
 * trong (tổng = Σ tồn cây con — không đếm đôi), lịch sử ledger, in lại tem. Mã nằm trên URL
 * (`?code=`) để dán link / quay lại được (luật 8).
 */
export function ContainersScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get('code')?.trim() ?? '';
  const [draft, setDraft] = useState(code);
  const query = useContainerByBarcode(code || null);
  const go = () => {
    const v = draft.trim();
    router.replace(v ? `/wms/containers?code=${encodeURIComponent(v)}` : '/wms/containers');
  };
  return (
    <>
      <PageHeader
        title="Thùng / pallet"
        description="Quét hoặc nhập mã tem LPN để xem hàng bên trong, cây cha–con và lịch sử"
        breadcrumb={[{ label: 'Kho' }, { label: 'Thùng / pallet' }]}
      />
      <form
        className="mb-3 flex max-w-xl items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="LPN2609-00001 hoặc mã NCC trên thùng…"
          className="font-mono"
          aria-label="Mã thùng"
          autoFocus
        />
        <Button type="submit" size="sm">
          <Search aria-hidden />
          Tra cứu
        </Button>
      </form>
      {!code ? (
        <EmptyState
          icon={Box}
          title="Chưa chọn thùng"
          description="Quét tem trên thùng / pallet hoặc mở từ chi tiết phiếu nhập."
        />
      ) : (
        <QueryState query={query} skeleton={<DetailSkeleton />}>
          {(c) => <Detail c={c} />}
        </QueryState>
      )}
    </>
  );
}
