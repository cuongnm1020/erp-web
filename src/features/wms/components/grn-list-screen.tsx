'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '@/components/data/row-actions';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { formatQuantity } from '@/lib/format';

const qty = (n: number) => formatQuantity(String(n));

type GrnStatus = 'draft' | 'receiving' | 'posted' | 'cancelled';

interface GrnRow {
  docNo: string;
  kind: string;
  kindTone: StatusTone;
  supplier: string;
  reference: string;
  warehouse: string;
  lineCount: number;
  totalQty: number;
  status: GrnStatus;
  createdBy: string;
  createdAt: string;
}

const STATUS_LABEL: Record<GrnStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Nháp', tone: 'draft' },
  receiving: { label: 'Đang nhận', tone: 'brand' },
  posted: { label: 'Đã post', tone: 'ok' },
  cancelled: { label: 'Hủy', tone: 'err' },
};

const SAMPLE_GRNS: GrnRow[] = [
  {
    docNo: 'GRN-2608-00087',
    kind: 'Từ PO',
    kindTone: 'neutral',
    supplier: 'Công ty CP Tập đoàn Thiên Long',
    reference: 'PO-2608-00041',
    warehouse: 'Kho HN-1',
    lineCount: 3,
    totalQty: 120,
    status: 'receiving',
    createdBy: 'Trần Văn Bảo',
    createdAt: '23/08/2026 08:00',
  },
  {
    docNo: 'GRN-2608-00086',
    kind: 'Từ PO',
    kindTone: 'neutral',
    supplier: 'Công ty TNHH Giấy Double A VN',
    reference: 'PO-2608-00041',
    warehouse: 'Kho HN-1',
    lineCount: 8,
    totalQty: 331,
    status: 'draft',
    createdBy: 'Phạm Thị Hoa',
    createdAt: '23/08/2026 11:19',
  },
  {
    docNo: 'GRN-2608-00085',
    kind: 'Nhập khác',
    kindTone: 'neutral',
    supplier: 'Tiến Phát Tape',
    reference: '—',
    warehouse: 'Kho HN-1',
    lineCount: 13,
    totalQty: 542,
    status: 'draft',
    createdBy: 'Nguyễn Đức Thắng',
    createdAt: '23/08/2026 14:38',
  },
  {
    docNo: 'GRN-2608-00084',
    kind: 'Từ PO',
    kindTone: 'neutral',
    supplier: 'Deli Việt Nam',
    reference: 'PO-2608-00040',
    warehouse: 'Kho HN-1',
    lineCount: 4,
    totalQty: 753,
    status: 'posted',
    createdBy: 'Hoàng Văn Long',
    createdAt: '22/08/2026 17:57',
  },
  {
    docNo: 'GRN-2608-00083',
    kind: 'Từ PO',
    kindTone: 'neutral',
    supplier: 'Plus Việt Nam',
    reference: 'PO-2608-00039',
    warehouse: 'Kho HN-1',
    lineCount: 9,
    totalQty: 964,
    status: 'posted',
    createdBy: 'Vũ Thị Lan',
    createdAt: '22/08/2026 10:16',
  },
  {
    docNo: 'GRN-2608-00082',
    kind: 'Hoàn từ đơn',
    kindTone: 'warn',
    supplier: '—',
    reference: 'SO-2608-01195',
    warehouse: 'Kho HN-1',
    lineCount: 14,
    totalQty: 1175,
    status: 'posted',
    createdBy: 'Đỗ Quang Huy',
    createdAt: '22/08/2026 13:35',
  },
  {
    docNo: 'GRN-2608-00081',
    kind: 'Từ PO',
    kindTone: 'neutral',
    supplier: 'Kokuyo Việt Nam',
    reference: 'PO-2608-00038',
    warehouse: 'Kho HN-1',
    lineCount: 5,
    totalQty: 1386,
    status: 'posted',
    createdBy: 'Trần Văn Bảo',
    createdAt: '21/08/2026 16:54',
  },
  {
    docNo: 'GRN-2608-00080',
    kind: 'Từ PO',
    kindTone: 'neutral',
    supplier: 'Canon Marketing VN',
    reference: 'PO-2608-00038',
    warehouse: 'Kho HN-1',
    lineCount: 10,
    totalQty: 1597,
    status: 'posted',
    createdBy: 'Phạm Thị Hoa',
    createdAt: '21/08/2026 09:13',
  },
  {
    docNo: 'GRN-2608-00079',
    kind: 'Nhập khác',
    kindTone: 'neutral',
    supplier: 'Công ty CP Tập đoàn Thiên Long',
    reference: '—',
    warehouse: 'Kho HN-1',
    lineCount: 15,
    totalQty: 1808,
    status: 'posted',
    createdBy: 'Nguyễn Đức Thắng',
    createdAt: '21/08/2026 12:32',
  },
  {
    docNo: 'GRN-2608-00078',
    kind: 'Từ PO',
    kindTone: 'neutral',
    supplier: 'Công ty TNHH Giấy Double A VN',
    reference: 'PO-2608-00037',
    warehouse: 'Kho HN-1',
    lineCount: 6,
    totalQty: 2019,
    status: 'posted',
    createdBy: 'Hoàng Văn Long',
    createdAt: '20/08/2026 15:51',
  },
  {
    docNo: 'GRN-2608-00076',
    kind: 'Hoàn từ đơn',
    kindTone: 'warn',
    supplier: '—',
    reference: 'SO-2608-01189',
    warehouse: 'Kho HN-1',
    lineCount: 16,
    totalQty: 2441,
    status: 'posted',
    createdBy: 'Đỗ Quang Huy',
    createdAt: '20/08/2026 11:29',
  },
  {
    docNo: 'GRN-2608-00073',
    kind: 'Nhập khác',
    kindTone: 'neutral',
    supplier: 'Kokuyo Việt Nam',
    reference: '—',
    warehouse: 'Kho HN-1',
    lineCount: 3,
    totalQty: 674,
    status: 'cancelled',
    createdBy: 'Nguyễn Đức Thắng',
    createdAt: '19/08/2026 10:26',
  },
  {
    docNo: 'GRN-2608-00072',
    kind: 'Từ PO',
    kindTone: 'neutral',
    supplier: 'Canon Marketing VN',
    reference: 'PO-2608-00034',
    warehouse: 'Kho HN-1',
    lineCount: 8,
    totalQty: 885,
    status: 'posted',
    createdBy: 'Hoàng Văn Long',
    createdAt: '18/08/2026 13:45',
  },
];

type TabKey = 'all' | GrnStatus;

const TABS: { key: TabKey; label: string; count: string }[] = [
  { key: 'all', label: 'Tất cả', count: '312' },
  { key: 'draft', label: 'Nháp', count: '6' },
  { key: 'receiving', label: 'Đang nhận', count: '4' },
  { key: 'posted', label: 'Đã post', count: '298' },
  { key: 'cancelled', label: 'Hủy', count: '4' },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}

function FilterChip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-background',
      )}
    >
      {children}
    </span>
  );
}

export function GrnListScreen() {
  const [tab, setTab] = useState<TabKey>('all');
  const rows = tab === 'all' ? SAMPLE_GRNS : SAMPLE_GRNS.filter((r) => r.status === tab);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Phiếu nhập kho"
        description="Kho HN-1 · tháng 08/2026"
        breadcrumb={[{ label: 'Kho' }, { label: 'Nhập kho' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button size="sm">
              Tạo phiếu nhập <Kbd>N</Kbd>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-8 w-72 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 truncate">Tìm số phiếu, PO, NCC…</span>
          <Kbd>/</Kbd>
        </div>
        <FilterChip active>
          Kho: Kho HN-1 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          Loại: Tất cả <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          Ngày: 01/08 – 23/08 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <Button variant="ghost" size="sm">
          + Lọc
        </Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Đã lưu: <b className="font-semibold">Mặc định</b>
          </span>
          <span>Cột</span>
        </div>
      </div>

      <div className="flex border-b" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm',
              tab === t.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">
                  <Checkbox aria-label="Chọn tất cả" />
                </TableHead>
                <TableHead className="px-2.5 text-primary">Số phiếu ↓</TableHead>
                <TableHead className="px-2.5">Loại</TableHead>
                <TableHead className="px-2.5">Nhà cung cấp</TableHead>
                <TableHead className="px-2.5">Tham chiếu</TableHead>
                <TableHead className="px-2.5">Kho</TableHead>
                <TableHead className="px-2.5 text-right">Số dòng</TableHead>
                <TableHead className="px-2.5 text-right">Tổng SL</TableHead>
                <TableHead className="px-2.5">Trạng thái</TableHead>
                <TableHead className="px-2.5">Người tạo</TableHead>
                <TableHead className="px-2.5">Ngày</TableHead>
                <TableHead className="w-20 px-2.5">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const st = STATUS_LABEL[r.status];
                return (
                  <TableRow key={r.docNo}>
                    <TableCell className="px-2.5 py-1.5">
                      <Checkbox aria-label={`Chọn ${r.docNo}`} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                      {r.docNo}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={r.kindTone}>{r.kind}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {r.supplier}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.reference}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {r.warehouse}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {qty(r.lineCount)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {qty(r.totalQty)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {r.createdBy}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {r.createdAt}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {/* Chứng từ đã post là bất biến — chỉ nháp mới sửa/xóa được */}
                      {r.status === 'draft' ? (
                        <RowActions
                          editHref={`/wms/grn/${r.docNo}`}
                          onDelete={() => toast.success(`Đã xóa phiếu nhập ${r.docNo} (mẫu)`)}
                          deleteLabel="Xóa nháp"
                          itemName={`phiếu nhập ${r.docNo}`}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–40 / 312</span>
          <span>· 40 dòng/trang</span>
          <span className="ml-auto">Trang 1 / 8</span>
        </div>
      </div>
    </div>
  );
}
