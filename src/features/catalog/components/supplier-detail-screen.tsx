'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/data/status-badge';
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
import { formatMoney } from '@/lib/format';

type TabKey = 'history' | 'po' | 'products' | 'debt';

interface GrnRow {
  grn: string;
  po: string;
  date: string;
  warehouse: string;
  lines: number;
  goods: string;
  amount: string;
  status: 'posted' | 'adjusted';
}

interface PoRow {
  po: string;
  createdAt: string;
  eta: string;
  warehouse: string;
  amount: string;
  status: string;
}

interface SuppliedSkuRow {
  sku: string;
  name: string;
  lastPrice: string;
  soleSource: boolean;
}

const SAMPLE_GRNS: GrnRow[] = [
  {
    grn: 'GRN-2608-00087',
    po: 'PO-2608-00041',
    date: '21/08/2026',
    warehouse: 'Kho HN-1',
    lines: 5,
    goods: 'TL08-BLUE ×4.800, TL08-RED ×2.400, TL08-BLACK ×2.400, TL-HL01-Y ×960…',
    amount: '48300000',
    status: 'posted',
  },
  {
    grn: 'GRN-2608-00071',
    po: 'PO-2608-00033',
    date: '14/08/2026',
    warehouse: 'Kho HCM-2',
    lines: 3,
    goods: 'TL08-BLUE ×7.200, TL-WB03-BL ×480, TL027-BLUE ×2.400',
    amount: '42150000',
    status: 'posted',
  },
  {
    grn: 'GRN-2608-00052',
    po: 'PO-2607-00118',
    date: '05/08/2026',
    warehouse: 'Kho HN-1',
    lines: 7,
    goods: 'TL08-BLUE ×9.600, TL08-RED ×4.800, TL-HL01-Y ×1.920…',
    amount: '91720000',
    status: 'posted',
  },
  {
    grn: 'GRN-2607-00214',
    po: 'PO-2607-00102',
    date: '28/07/2026',
    warehouse: 'Kho HN-1',
    lines: 2,
    goods: 'TL-WB03-BL ×1.680, TL-HL01-Y ×960',
    amount: '18336000',
    status: 'posted',
  },
  {
    grn: 'GRN-2607-00180',
    po: 'PO-2607-00088',
    date: '19/07/2026',
    warehouse: 'Kho HCM-2',
    lines: 4,
    goods: 'TL08-BLACK ×4.800, TL027-BLUE ×4.800, TL027-RED ×2.400…',
    amount: '54900000',
    status: 'posted',
  },
  {
    grn: 'GRN-2607-00133',
    po: 'PO-2607-00061',
    date: '10/07/2026',
    warehouse: 'Kho HN-1',
    lines: 6,
    goods: 'TL08-BLUE ×14.400, TL08-RED ×4.800…',
    amount: '96600000',
    status: 'posted',
  },
  {
    grn: 'GRN-2607-00097',
    po: 'PO-2606-00140',
    date: '02/07/2026',
    warehouse: 'Kho HN-1',
    lines: 1,
    goods: 'TL-HL01-Y ×2.880',
    amount: '13824000',
    status: 'posted',
  },
  {
    grn: 'GRN-2606-00241',
    po: 'PO-2606-00119',
    date: '24/06/2026',
    warehouse: 'Kho HCM-2',
    lines: 5,
    goods: 'TL08-BLUE ×7.200, TL-WB03-BL ×960…',
    amount: '49860000',
    status: 'posted',
  },
  {
    grn: 'GRN-2606-00188',
    po: 'PO-2606-00094',
    date: '15/06/2026',
    warehouse: 'Kho HN-1',
    lines: 3,
    goods: 'TL027-BLUE ×4.800, TL027-RED ×2.400, TL-036 ×2.400',
    amount: '29400000',
    status: 'posted',
  },
  {
    grn: 'GRN-2606-00142',
    po: 'PO-2606-00070',
    date: '08/06/2026',
    warehouse: 'Kho HN-1',
    lines: 4,
    goods: 'TL08-BLUE ×9.600, TL08-BLACK ×2.400…',
    amount: '57200000',
    status: 'posted',
  },
  {
    grn: 'GRN-2605-00301',
    po: 'PO-2605-00151',
    date: '29/05/2026',
    warehouse: 'Kho HCM-2',
    lines: 2,
    goods: 'TL-HL01-Y ×1.920, TL-HL01-P ×960',
    amount: '13900000',
    status: 'adjusted',
  },
  {
    grn: 'GRN-2605-00255',
    po: 'PO-2605-00128',
    date: '21/05/2026',
    warehouse: 'Kho HN-1',
    lines: 6,
    goods: 'TL08-BLUE ×12.000, TL08-RED ×4.800…',
    amount: '84300000',
    status: 'posted',
  },
];

const SAMPLE_POS: PoRow[] = [
  {
    po: 'PO-2608-00041',
    createdAt: '18/08/2026',
    eta: '26/08/2026',
    warehouse: 'Kho HN-1',
    amount: '84200000',
    status: 'Đang giao',
  },
  {
    po: 'PO-2608-00055',
    createdAt: '20/08/2026',
    eta: '27/08/2026',
    warehouse: 'Kho HCM-2',
    amount: '62400000',
    status: 'Đã xác nhận',
  },
  {
    po: 'PO-2608-00060',
    createdAt: '22/08/2026',
    eta: '29/08/2026',
    warehouse: 'Kho HN-1',
    amount: '37600000',
    status: 'Chờ xác nhận',
  },
];

const SAMPLE_SKUS: SuppliedSkuRow[] = [
  { sku: 'TL08-BLUE', name: 'Bút bi Thiên Long TL-08 xanh', lastPrice: '2410', soleSource: true },
  { sku: 'TL08-RED', name: 'Bút bi Thiên Long TL-08 đỏ', lastPrice: '2410', soleSource: true },
  { sku: 'TL08-BLACK', name: 'Bút bi Thiên Long TL-08 đen', lastPrice: '2410', soleSource: true },
  {
    sku: 'TL027-BLUE',
    name: 'Bút bi Thiên Long TL-027 xanh',
    lastPrice: '2050',
    soleSource: false,
  },
  {
    sku: 'TL-HL01-Y',
    name: 'Bút dạ quang Thiên Long HL-01 vàng',
    lastPrice: '4800',
    soleSource: false,
  },
  {
    sku: 'TL-WB03-BL',
    name: 'Bút lông bảng Thiên Long WB-03 xanh',
    lastPrice: '5100',
    soleSource: false,
  },
];

const TABS: Array<{ key: TabKey; label: string; count: React.ReactNode }> = [
  { key: 'history', label: 'Lịch sử mua', count: '38' },
  { key: 'po', label: 'PO', count: '3 mở' },
  { key: 'products', label: 'Sản phẩm cung cấp', count: '64' },
  { key: 'debt', label: 'Công nợ', count: 'quá hạn' },
];

const INFO_ROWS: Array<{ label: string; value: React.ReactNode }> = [
  { label: 'Liên hệ', value: 'Nguyễn Thị Thu Hà · KD miền Bắc' },
  { label: 'SĐT', value: '028 3750 5555 · 0903 112 233' },
  { label: 'Email', value: <span className="text-primary">thuha.nt@thienlong.vn</span> },
  { label: 'Địa chỉ', value: 'Lô 6-8-10, đường số 3, KCN Tân Tạo, Q. Bình Tân, TP.HCM' },
  { label: 'Điều khoản', value: <span className="font-semibold">Net 30</span> },
  { label: 'Hạn mức nợ', value: '500.000.000' },
  { label: 'Thanh toán', value: 'CK · Vietcombank 0071 000 123 456' },
  { label: 'Giao hàng', value: 'NCC giao tận kho, tối thiểu 20.000.000/PO' },
];

const NUM_CELL = 'px-2.5 py-1.5 text-right tabular-nums';
const HEAD = 'px-2.5 text-xs';

function HistoryTab() {
  return (
    <>
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <div className="flex h-7 w-56 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Tìm phiếu, PO, SKU…</span>
        </div>
        <span className="inline-flex h-7 items-center rounded-md border border-input bg-card px-2 text-sm">
          12 tháng qua ▾
        </span>
        <span className="inline-flex h-7 items-center rounded-md border border-input bg-card px-2 text-sm">
          Kho: Tất cả ▾
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Tổng kỳ lọc:{' '}
          <span className="font-semibold tabular-nums text-foreground">1.284.560.000</span>
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={cn(HEAD, 'w-36')}>Phiếu nhập</TableHead>
            <TableHead className={cn(HEAD, 'w-32')}>PO</TableHead>
            <TableHead className={cn(HEAD, 'w-24')}>Ngày nhập</TableHead>
            <TableHead className={cn(HEAD, 'w-24')}>Kho</TableHead>
            <TableHead className={cn(HEAD, 'w-16 text-right')}>Dòng</TableHead>
            <TableHead className={HEAD}>Hàng nhận</TableHead>
            <TableHead className={cn(HEAD, 'w-32 text-right')}>Giá trị</TableHead>
            <TableHead className={cn(HEAD, 'w-28')}>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SAMPLE_GRNS.map((g) => (
            <TableRow key={g.grn}>
              <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                {g.grn}
              </TableCell>
              <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">{g.po}</TableCell>
              <TableCell className="px-2.5 py-1.5">{g.date}</TableCell>
              <TableCell className="px-2.5 py-1.5">{g.warehouse}</TableCell>
              <TableCell className={NUM_CELL}>{g.lines}</TableCell>
              <TableCell
                className="max-w-80 truncate px-2.5 py-1.5 text-muted-foreground"
                title={g.goods}
              >
                {g.goods}
              </TableCell>
              <TableCell className={NUM_CELL}>{formatMoney(g.amount, { unit: '' })}</TableCell>
              <TableCell className="px-2.5 py-1.5">
                {g.status === 'posted' ? (
                  <StatusBadge tone="ok">Đã nhập</StatusBadge>
                ) : (
                  <StatusBadge tone="warn">Có điều chỉnh</StatusBadge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span>Hiển thị 1–16 / 38</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="rounded border border-input px-1.5 py-0.5">‹</span>
          <span className="rounded border border-primary bg-primary px-1.5 py-0.5 text-primary-foreground">
            1
          </span>
          <span className="rounded border border-input px-1.5 py-0.5">2</span>
          <span className="rounded border border-input px-1.5 py-0.5">3</span>
          <span className="rounded border border-input px-1.5 py-0.5">›</span>
        </div>
      </div>
    </>
  );
}

function PoTab() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted hover:bg-muted">
          <TableHead className={cn(HEAD, 'w-36')}>PO</TableHead>
          <TableHead className={cn(HEAD, 'w-28')}>Ngày tạo</TableHead>
          <TableHead className={cn(HEAD, 'w-28')}>Giao dự kiến</TableHead>
          <TableHead className={cn(HEAD, 'w-28')}>Kho nhận</TableHead>
          <TableHead className={cn(HEAD, 'w-32 text-right')}>Giá trị</TableHead>
          <TableHead className={HEAD}>Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SAMPLE_POS.map((p) => (
          <TableRow key={p.po}>
            <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">{p.po}</TableCell>
            <TableCell className="px-2.5 py-1.5">{p.createdAt}</TableCell>
            <TableCell className="px-2.5 py-1.5">{p.eta}</TableCell>
            <TableCell className="px-2.5 py-1.5">{p.warehouse}</TableCell>
            <TableCell className={NUM_CELL}>{formatMoney(p.amount, { unit: '' })}</TableCell>
            <TableCell className="px-2.5 py-1.5">
              <StatusBadge tone="draft">{p.status}</StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProductsTab() {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={cn(HEAD, 'w-32')}>SKU</TableHead>
            <TableHead className={HEAD}>Tên sản phẩm</TableHead>
            <TableHead className={cn(HEAD, 'w-36 text-right')}>Giá mua gần nhất</TableHead>
            <TableHead className={cn(HEAD, 'w-32')}>Nguồn cung</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SAMPLE_SKUS.map((s) => (
            <TableRow key={s.sku}>
              <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                {s.sku}
              </TableCell>
              <TableCell className="max-w-72 truncate px-2.5 py-1.5" title={s.name}>
                {s.name}
              </TableCell>
              <TableCell className={NUM_CELL}>{formatMoney(s.lastPrice, { unit: '' })}</TableCell>
              <TableCell className="px-2.5 py-1.5">
                {s.soleSource ? (
                  <StatusBadge tone="warn">NCC duy nhất</StatusBadge>
                ) : (
                  <span className="text-muted-foreground">nhiều NCC</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        Hiển thị 6 / 64 SKU · 12 SKU là NCC duy nhất
      </div>
    </>
  );
}

function DebtTab() {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="rounded-md border bg-destructive/10 p-3 text-sm text-destructive">
        <span className="font-semibold">96.000.000 quá hạn</span> · 1 hóa đơn (INV-NCC-2607-0031,
        hạn 20/08/2026). Ghi nhận thanh toán hoặc trao đổi lại điều khoản với NCC.
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={cn(HEAD, 'w-44')}>Hóa đơn</TableHead>
            <TableHead className={cn(HEAD, 'w-28')}>Ngày</TableHead>
            <TableHead className={cn(HEAD, 'w-28')}>Hạn thanh toán</TableHead>
            <TableHead className={cn(HEAD, 'w-36 text-right')}>Còn phải trả</TableHead>
            <TableHead className={HEAD}>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-destructive/10 hover:bg-destructive/10">
            <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
              INV-NCC-2607-0031
            </TableCell>
            <TableCell className="px-2.5 py-1.5">21/07/2026</TableCell>
            <TableCell className="px-2.5 py-1.5">20/08/2026</TableCell>
            <TableCell className={cn(NUM_CELL, 'font-semibold text-destructive')}>
              {formatMoney('96000000', { unit: '' })}
            </TableCell>
            <TableCell className="px-2.5 py-1.5">
              <StatusBadge tone="err">Quá hạn 3 ngày</StatusBadge>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
              INV-NCC-2608-0012
            </TableCell>
            <TableCell className="px-2.5 py-1.5">05/08/2026</TableCell>
            <TableCell className="px-2.5 py-1.5">04/09/2026</TableCell>
            <TableCell className={NUM_CELL}>{formatMoney('178200000', { unit: '' })}</TableCell>
            <TableCell className="px-2.5 py-1.5">
              <StatusBadge tone="draft">Trong hạn</StatusBadge>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
              INV-NCC-2608-0027
            </TableCell>
            <TableCell className="px-2.5 py-1.5">21/08/2026</TableCell>
            <TableCell className="px-2.5 py-1.5">20/09/2026</TableCell>
            <TableCell className={NUM_CELL}>{formatMoney('138300000', { unit: '' })}</TableCell>
            <TableCell className="px-2.5 py-1.5">
              <StatusBadge tone="draft">Trong hạn</StatusBadge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export function SupplierDetailScreen() {
  const [tab, setTab] = useState<TabKey>('history');

  return (
    <>
      <PageHeader
        title="Công ty CP Tập đoàn Thiên Long"
        description="Mã NCC-0001 · MST 0301464896 · Hợp tác từ 03/2019 · Người theo dõi: Phạm Quốc Huy (Thu mua)"
        breadcrumb={[
          { label: 'Sản phẩm', href: '/catalog/products' },
          { label: 'Nhà cung cấp', href: '/catalog/suppliers' },
          { label: 'NCC-0001' },
        ]}
        actions={
          <>
            <StatusBadge tone="ok">Hoạt động</StatusBadge>
            <Button variant="outline" size="sm">
              Ghi nhận thanh toán
            </Button>
            <Button variant="outline" size="sm">
              Sửa
            </Button>
            <Button size="sm">
              <Plus /> Tạo PO
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-5 gap-3">
        <KpiCard label="Mua 12 tháng" value="1.284.560.000" detail="38 phiếu nhập" />
        <KpiCard
          label="Phải trả hiện tại"
          value="412.500.000"
          detail={
            <>
              <span className="text-destructive">96.000.000 quá hạn</span> · 1 hóa đơn
            </>
          }
        />
        <KpiCard label="PO đang mở" value="3" detail="184.200.000 · giao dự kiến 26/08" />
        <KpiCard label="Thời gian giao TB" value="4,2 ngày" detail="đúng hẹn 92%" />
        <KpiCard label="SKU cung cấp" value="64" detail="12 SKU là NCC duy nhất" />
      </div>

      <div className="grid grid-cols-[300px_1fr] items-start gap-3">
        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-card">
            <div className="border-b px-3 py-2 text-sm font-semibold">Thông tin</div>
            <dl className="space-y-1.5 p-3 text-sm">
              {INFO_ROWS.map((r) => (
                <div key={r.label} className="grid grid-cols-[90px_1fr] gap-2">
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-md border bg-card">
            <div className="border-b px-3 py-2 text-sm font-semibold">Ghi chú nội bộ</div>
            <div className="p-3 text-sm text-muted-foreground">
              Chiết khấu thêm 2% khi PO &gt; 100.000.000. Liên hệ trước 15:00 để giao trong ngày hôm
              sau.
              <div className="mt-1.5 text-xs">Phạm Quốc Huy · 12/06/2026</div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex border-b px-2" role="tablist" aria-label="Chi tiết nhà cung cấp">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm',
                  tab === t.key
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs',
                    t.key === 'debt'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            {tab === 'history' ? <HistoryTab /> : null}
            {tab === 'po' ? <PoTab /> : null}
            {tab === 'products' ? <ProductsTab /> : null}
            {tab === 'debt' ? <DebtTab /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
