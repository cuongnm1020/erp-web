'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, ChevronRight } from 'lucide-react';
import { RowActions } from '@/components/data/row-actions';
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
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { formatQuantity } from '@/lib/format';

const qty = (n: number) => formatQuantity(String(n));

interface WarehouseRow {
  code: string;
  name: string;
  address: string;
  binCount: string;
  staffCount: string;
  status: string;
  statusTone: StatusTone;
  selected?: boolean;
}

const SAMPLE_WAREHOUSES: WarehouseRow[] = [
  {
    code: 'HN-1',
    name: 'Kho HN-1',
    address: 'Lô C3, KCN Quang Minh, Mê Linh, Hà Nội',
    binCount: '412',
    staffCount: '14',
    status: 'Hoạt động',
    statusTone: 'ok',
    selected: true,
  },
  {
    code: 'HCM-2',
    name: 'Kho HCM-2',
    address: 'Số 18 Võ Văn Kiệt, Q.6, TP.HCM',
    binCount: '586',
    staffCount: '19',
    status: 'Hoạt động',
    statusTone: 'ok',
  },
  {
    code: 'DN-3',
    name: 'Kho ĐN-3',
    address: 'KCN Hòa Khánh, Liên Chiểu, Đà Nẵng',
    binCount: '148',
    staffCount: '5',
    status: 'Hoạt động',
    statusTone: 'ok',
  },
  {
    code: 'HN-TL',
    name: 'Kho HN-TL (trả/lỗi)',
    address: 'Lô C3, KCN Quang Minh — khu D',
    binCount: '36',
    staffCount: '2',
    status: 'Kho ảo',
    statusTone: 'draft',
  },
  {
    code: 'TRANSIT',
    name: 'Kho trung chuyển',
    address: 'Hàng đang di chuyển giữa kho',
    binCount: '—',
    staffCount: '—',
    status: 'Kho ảo',
    statusTone: 'draft',
  },
];

interface StaffRow {
  name: string;
  role: string;
  device: string;
  online: boolean;
}

const SAMPLE_STAFF: StaffRow[] = [
  { name: 'Trần Văn Bảo', role: 'Nhận / cất', device: 'PDA-03', online: true },
  { name: 'Phạm Thị Hoa', role: 'Lấy hàng', device: 'PDA-07', online: true },
  { name: 'Nguyễn Đức Thắng', role: 'Lấy hàng', device: 'PDA-02', online: true },
  { name: 'Hoàng Văn Long', role: 'Đóng gói', device: 'PDA-05', online: true },
  { name: 'Vũ Thị Lan', role: 'Kiểm kê', device: 'PDA-09', online: true },
  { name: 'Đỗ Quang Huy', role: 'Kiểm kê', device: 'PDA-04', online: true },
  { name: 'Bùi Thị Mai', role: 'Lấy hàng', device: '—', online: false },
  { name: 'Ngô Văn Tuấn', role: 'Nhận / cất', device: 'PDA-01', online: true },
  { name: 'Lý Thị Thu', role: 'Đóng gói', device: '—', online: false },
];

interface TreeNode {
  /** 0 kho · 1 zone · 2 aisle · 3 rack · 4 bin */
  level: 0 | 1 | 2 | 3 | 4;
  name: string;
  label: string;
  stat: string;
  expanded?: boolean;
  leaf?: boolean;
  selected?: boolean;
  /** ô đạt 100% sức chứa — chữ vàng */
  full?: boolean;
}

const SAMPLE_TREE: TreeNode[] = [
  {
    level: 0,
    name: 'Kho HN-1',
    label: 'Hà Nội — 4 khu',
    stat: '284 SKU · 186.420',
    expanded: true,
  },
  {
    level: 1,
    name: 'Khu A',
    label: 'Văn phòng phẩm nhẹ',
    stat: '124 SKU · 48.200',
    expanded: true,
  },
  { level: 2, name: 'A-01', label: 'Dãy 1 · 6 kệ', stat: '38 SKU · 14.900' },
  { level: 2, name: 'A-02', label: 'Dãy 2 · 6 kệ', stat: '41 SKU · 16.350' },
  { level: 2, name: 'A-03', label: 'Dãy 3 · 4 kệ', stat: '45 SKU · 16.950', expanded: true },
  { level: 3, name: 'A-03-01', label: 'Kệ 1 · 4 ô', stat: '12 SKU · 4.120' },
  { level: 3, name: 'A-03-02', label: 'Kệ 2 · 4 ô', stat: '14 SKU · 5.640', expanded: true },
  { level: 4, name: 'A-03-02-A', label: 'Ô A', stat: '3 SKU · 1.380', leaf: true },
  { level: 4, name: 'A-03-02-B', label: 'Ô B', stat: '4 SKU · 2.260', leaf: true, selected: true },
  { level: 4, name: 'A-03-02-C', label: 'Ô C', stat: '5 SKU · 1.520', leaf: true, full: true },
  { level: 4, name: 'A-03-02-D', label: 'Ô D · trống', stat: '0 SKU · 0', leaf: true },
  { level: 3, name: 'A-03-03', label: 'Kệ 3 · 4 ô', stat: '11 SKU · 3.870' },
  { level: 3, name: 'A-03-04', label: 'Kệ 4 · 4 ô', stat: '8 SKU · 3.320' },
  { level: 1, name: 'Khu B', label: 'Giấy & hàng nặng', stat: '62 SKU · 71.300' },
  { level: 1, name: 'Khu C', label: 'Mực in & thiết bị', stat: '58 SKU · 9.820' },
  { level: 1, name: 'Khu D', label: 'Hàng trả / chờ xử lý', stat: '40 SKU · 57.100' },
];

const TREE_INDENT: Record<TreeNode['level'], string> = {
  0: 'pl-2',
  1: 'pl-6',
  2: 'pl-10',
  3: 'pl-14',
  4: 'pl-16',
};

interface BinStockRow {
  sku: string;
  name: string;
  lot: string;
  expiry: string;
  onHand: number;
  reserved: number;
  available: number;
}

const SAMPLE_BIN_ROWS: BinStockRow[] = [
  {
    sku: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    lot: 'L2607',
    expiry: '12/2028',
    onHand: 1240,
    reserved: 96,
    available: 1144,
  },
  {
    sku: 'TL08-RED',
    name: 'Bút bi Thiên Long TL-08 đỏ',
    lot: 'L2607',
    expiry: '12/2028',
    onHand: 480,
    reserved: 24,
    available: 456,
  },
  {
    sku: 'TL027-BLK',
    name: 'Bút bi Thiên Long TL-027 đen',
    lot: 'L2605',
    expiry: '10/2028',
    onHand: 360,
    reserved: 0,
    available: 360,
  },
  {
    sku: 'TL-HL01',
    name: 'Bút dạ quang Thiên Long HL-01 vàng',
    lot: 'L2603',
    expiry: '06/2027',
    onHand: 180,
    reserved: 12,
    available: 168,
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}

export function WarehousesScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Kho & vị trí"
        description="5 kho · 1.182 vị trí · 30 nhân viên kho"
        breadcrumb={[{ label: 'Kho' }, { label: 'Kho & vị trí' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              In tem vị trí
            </Button>
            <Button variant="outline" size="sm">
              Thêm vị trí
            </Button>
            <Button size="sm">Tạo kho</Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Cột trái: danh sách kho + nhân viên */}
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="px-2.5">Mã</TableHead>
                    <TableHead className="px-2.5">Tên kho</TableHead>
                    <TableHead className="px-2.5">Địa chỉ</TableHead>
                    <TableHead className="px-2.5 text-right">Số vị trí</TableHead>
                    <TableHead className="px-2.5 text-right">Nhân viên</TableHead>
                    <TableHead className="px-2.5">Trạng thái</TableHead>
                    <TableHead className="w-20 px-2.5">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_WAREHOUSES.map((w) => (
                    <TableRow
                      key={w.code}
                      className={w.selected ? 'bg-secondary hover:bg-secondary' : undefined}
                    >
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                        {w.code}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 font-semibold">{w.name}</TableCell>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                        {w.address}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {w.binCount}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {w.staffCount}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <StatusBadge tone={w.statusTone}>{w.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <RowActions
                          onEdit={() => toast.info('UI-first — form sửa kho chưa nối API')}
                          onDelete={() => toast.success(`Đã xóa kho ${w.code} (mẫu)`)}
                          itemName={`kho ${w.code}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
              <span>
                Nhân viên Kho HN-1{' '}
                <span className="font-normal text-muted-foreground">· 14 · 9 đang online</span>
              </span>
              <span className="text-xs font-normal text-primary">Liên kết thiết bị PDA</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="px-2.5">Nhân viên</TableHead>
                    <TableHead className="px-2.5">Vai trò</TableHead>
                    <TableHead className="px-2.5">Thiết bị</TableHead>
                    <TableHead className="px-2.5">Trạng thái</TableHead>
                    <TableHead className="w-20 px-2.5">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_STAFF.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="px-2.5 py-1.5">{s.name}</TableCell>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                        {s.role}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{s.device}</TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {s.online ? (
                          <StatusBadge tone="ok">Online</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Ngoài ca</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <RowActions
                          onEdit={() =>
                            toast.info('UI-first — form sửa nhân viên kho chưa nối API')
                          }
                          onDelete={() => toast.success(`Đã xóa nhân viên ${s.name} (mẫu)`)}
                          itemName={`nhân viên ${s.name}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Cột phải: cây vị trí + ô đang chọn */}
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
              <span>Sơ đồ vị trí — Kho HN-1</span>
              <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <Kbd>←→</Kbd> thu/mở <Kbd>↑↓</Kbd> chọn ·{' '}
                <span className="text-primary">Mở rộng tất cả</span>
              </span>
            </div>
            <div>
              {SAMPLE_TREE.map((n) => (
                <div
                  key={n.name}
                  className={cn(
                    'flex h-8 items-center gap-2 border-b pr-3 text-sm last:border-0',
                    TREE_INDENT[n.level],
                    n.selected && 'bg-secondary',
                  )}
                >
                  <span className="flex w-4 justify-center text-muted-foreground">
                    {n.leaf ? null : n.expanded ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                  <span
                    className={cn(
                      'font-semibold',
                      n.selected && 'text-primary',
                      n.full && 'text-warning',
                    )}
                  >
                    {n.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{n.label}</span>
                  <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {n.stat}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
              <span>Zone → Aisle → Rack → Bin · số = SKU · tồn thực (đơn vị cơ bản)</span>
              <span className="ml-auto text-warning">Màu vàng = ô đạt 100% sức chứa</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-primary">A-03-02-B</span>
                <span className="text-xs text-muted-foreground">
                  Khu A · Dãy 3 · Kệ 2 · Ô B · sức chứa 80%
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  Chuyển vị trí
                </Button>
                <Button variant="outline" size="sm">
                  Kiểm kê ô này
                </Button>
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="px-2.5">SKU</TableHead>
                    <TableHead className="px-2.5">Tên</TableHead>
                    <TableHead className="px-2.5">Lô</TableHead>
                    <TableHead className="px-2.5">HSD</TableHead>
                    <TableHead className="px-2.5 text-right">Tồn thực</TableHead>
                    <TableHead className="px-2.5 text-right">Đang giữ</TableHead>
                    <TableHead className="px-2.5 text-right">Khả dụng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_BIN_ROWS.map((r) => (
                    <TableRow key={r.sku}>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                        {r.sku}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">{r.name}</TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.lot}</TableCell>
                      <TableCell className="px-2.5 py-1.5">{r.expiry}</TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {qty(r.onHand)}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {qty(r.reserved)}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                        {qty(r.available)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
