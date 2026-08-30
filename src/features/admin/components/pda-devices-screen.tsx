'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { AlertTriangle, ChevronDown, Search, X } from 'lucide-react';
import { RowActions } from '@/components/data/row-actions';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { formatDateTime } from '@/lib/format';

interface DeviceRow {
  code: string;
  model: string;
  serial: string;
  warehouse: string;
  assignedTo: string | null;
  lastOnlineAt: string | null;
  appVersion: string;
  status: 'online' | 'unassigned' | 'temporary' | 'offline24h';
  selected?: boolean;
}

const STATUS_LABEL: Record<DeviceRow['status'], { label: string; tone: StatusTone }> = {
  online: { label: 'Online', tone: 'ok' },
  unassigned: { label: 'Chưa gán', tone: 'neutral' },
  temporary: { label: 'Gán tạm', tone: 'warn' },
  offline24h: { label: 'Offline > 24h', tone: 'err' },
};

const SAMPLE_DEVICES: DeviceRow[] = [
  {
    code: 'PDA-HN-01',
    model: 'Zebra TC21',
    serial: 'SN-481200',
    warehouse: 'Kho HN-1',
    assignedTo: 'Trịnh Thị Mai',
    lastOnlineAt: '2026-08-23T10:01:00+07:00',
    appVersion: 'v2.3.8',
    status: 'online',
  },
  {
    code: 'PDA-HN-02',
    model: 'Zebra TC21',
    serial: 'SN-481207',
    warehouse: 'Kho HN-1',
    assignedTo: 'Đinh Văn Phúc',
    lastOnlineAt: '2026-08-23T10:04:00+07:00',
    appVersion: 'v2.4.1',
    status: 'online',
  },
  {
    code: 'PDA-HN-03',
    model: 'Honeywell EDA52',
    serial: 'SN-481214',
    warehouse: 'Kho HN-1',
    assignedTo: 'Cao Thị Yến',
    lastOnlineAt: '2026-08-23T10:07:00+07:00',
    appVersion: 'v2.4.1',
    status: 'online',
  },
  {
    code: 'PDA-HN-04',
    model: 'Zebra TC26',
    serial: 'SN-481221',
    warehouse: 'Kho HN-1',
    assignedTo: null,
    lastOnlineAt: null,
    appVersion: 'v2.4.1',
    status: 'unassigned',
    selected: true,
  },
  {
    code: 'PDA-HN-05',
    model: 'Urovo DT50',
    serial: 'SN-481228',
    warehouse: 'Kho HN-1',
    assignedTo: 'Lý Văn Sơn',
    lastOnlineAt: '2026-08-23T10:13:00+07:00',
    appVersion: 'v2.3.8',
    status: 'online',
  },
  {
    code: 'PDA-HN-06',
    model: 'Zebra TC21',
    serial: 'SN-481235',
    warehouse: 'Kho HN-1',
    assignedTo: 'Nguyễn Văn An',
    lastOnlineAt: '2026-08-21T16:02:00+07:00',
    appVersion: 'v2.4.1',
    status: 'temporary',
  },
  {
    code: 'PDA-HN-07',
    model: 'Zebra TC21',
    serial: 'SN-481242',
    warehouse: 'Kho HN-1',
    assignedTo: null,
    lastOnlineAt: null,
    appVersion: 'v2.4.1',
    status: 'unassigned',
  },
  {
    code: 'PDA-HN-08',
    model: 'Honeywell EDA52',
    serial: 'SN-481249',
    warehouse: 'Kho HN-1',
    assignedTo: 'Trần Văn Hải',
    lastOnlineAt: '2026-08-23T10:22:00+07:00',
    appVersion: 'v2.4.1',
    status: 'online',
  },
  {
    code: 'PDA-HCM-01',
    model: 'Zebra TC21',
    serial: 'SN-481201',
    warehouse: 'Kho HCM-2',
    assignedTo: 'Lương Thị Hoa',
    lastOnlineAt: '2026-08-23T10:01:00+07:00',
    appVersion: 'v2.3.8',
    status: 'online',
  },
  {
    code: 'PDA-HCM-02',
    model: 'Honeywell EDA52',
    serial: 'SN-481208',
    warehouse: 'Kho HCM-2',
    assignedTo: 'Phan Văn Long',
    lastOnlineAt: '2026-08-23T10:04:00+07:00',
    appVersion: 'v2.4.1',
    status: 'online',
  },
  {
    code: 'PDA-HCM-04',
    model: 'Urovo DT50',
    serial: 'SN-481222',
    warehouse: 'Kho HCM-2',
    assignedTo: 'Mai Văn Đức',
    lastOnlineAt: '2026-08-23T10:10:00+07:00',
    appVersion: 'v2.4.1',
    status: 'online',
  },
  {
    code: 'PDA-HCM-05',
    model: 'Zebra TC21',
    serial: 'SN-481229',
    warehouse: 'Kho HCM-2',
    assignedTo: null,
    lastOnlineAt: null,
    appVersion: 'v2.3.8',
    status: 'unassigned',
  },
  {
    code: 'PDA-HCM-09',
    model: 'Urovo DT50',
    serial: 'SN-481257',
    warehouse: 'Kho HCM-2',
    assignedTo: 'Đỗ Thị Lan',
    lastOnlineAt: '2026-08-21T16:02:00+07:00',
    appVersion: 'v2.3.8',
    status: 'offline24h',
  },
  {
    code: 'PDA-HCM-10',
    model: 'Zebra TC21',
    serial: 'SN-481264',
    warehouse: 'Kho HCM-2',
    assignedTo: 'Bùi Văn Nhật',
    lastOnlineAt: '2026-08-23T10:28:00+07:00',
    appVersion: 'v2.4.1',
    status: 'online',
  },
  {
    code: 'PDA-HCM-12',
    model: 'Honeywell EDA52',
    serial: 'SN-481278',
    warehouse: 'Kho HCM-2',
    assignedTo: 'Ngô Văn Hưng',
    lastOnlineAt: '2026-08-23T10:34:00+07:00',
    appVersion: 'v2.4.1',
    status: 'online',
  },
];

function FilterChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs text-muted-foreground hover:bg-muted"
    >
      {label}
      <ChevronDown className="h-3 w-3" aria-hidden />
    </button>
  );
}

export function PdaDevicesScreen() {
  return (
    <>
      <PageHeader
        title="Thiết bị PDA"
        description="22 thiết bị · 17 đang gán · 14 online · 2 offline > 24 giờ"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Hệ thống' }, { label: 'Thiết bị PDA' }]}
        actions={
          <>
            <Button variant="outline">Cấu hình chung</Button>
            <Button>Đăng ký thiết bị</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input className="h-7 pl-8 text-xs" placeholder="Tìm mã thiết bị, serial, tài khoản…" />
        </div>
        <FilterChip label="Kho: Tất cả" />
        <FilterChip label="Trạng thái: Tất cả" />
        <FilterChip label="Phiên bản app" />
        <div className="ml-auto text-xs text-muted-foreground">
          Đã lưu: <span className="font-semibold text-foreground">Mặc định</span>
        </div>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-md border bg-card">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-8 px-2.5">
                  <Checkbox aria-label="Chọn tất cả" />
                </TableHead>
                <TableHead className="px-2.5">Mã thiết bị ↑</TableHead>
                <TableHead className="px-2.5">Tên / model</TableHead>
                <TableHead className="px-2.5">Serial</TableHead>
                <TableHead className="px-2.5">Kho</TableHead>
                <TableHead className="px-2.5">Tài khoản gán</TableHead>
                <TableHead className="px-2.5 text-right">Online cuối</TableHead>
                <TableHead className="px-2.5 text-right">App</TableHead>
                <TableHead className="px-2.5">Trạng thái</TableHead>
                <TableHead className="w-20 px-2.5">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_DEVICES.map((d) => {
                const s = STATUS_LABEL[d.status];
                return (
                  <TableRow key={d.code} className={cn(d.selected && 'bg-secondary/50')}>
                    <TableCell className="px-2.5 py-1.5">
                      <Checkbox aria-label={`Chọn ${d.code}`} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                      {d.code}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{d.model}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                      {d.serial}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{d.warehouse}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {d.assignedTo ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {d.lastOnlineAt ? formatDateTime(d.lastOnlineAt) : '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {d.appVersion}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <RowActions
                        onEdit={() => toast.info('UI-first — form sửa thiết bị chưa nối API')}
                        onDelete={() => toast.success(`Đã xóa thiết bị ${d.code} (mẫu)`)}
                        itemName={`thiết bị ${d.code}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-2.5 py-1.5 text-xs text-muted-foreground">
            <span>Hiển thị 1–22 / 22</span>
            <span className="flex items-center gap-1">
              <span className="px-1.5">‹</span>
              <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-semibold text-primary">
                1
              </span>
              <span className="px-1.5">›</span>
              <span className="ml-2">40 dòng/trang</span>
            </span>
          </div>
        </div>

        <aside className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Gán tài khoản · PDA-HN-04</h2>
            <X className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-3 p-3">
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-xs text-muted-foreground">Thiết bị</dt>
                <dd>Zebra TC26 · SN-481221</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-xs text-muted-foreground">Kho</dt>
                <dd>Kho HN-1</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-xs text-muted-foreground">Hiện gán</dt>
                <dd className="text-muted-foreground">Chưa gán</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-xs text-muted-foreground">Online cuối</dt>
                <dd>21/08/2026 16:02 · app v2.4.1</dd>
              </div>
            </dl>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                Tài khoản kho <span className="text-destructive">*</span>
              </span>
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input defaultValue="Cao" className="h-8 pl-8" />
              </div>
              <p className="text-xs text-muted-foreground">
                Chỉ tài khoản vai trò NV kho / Quản lý kho thuộc Kho HN-1
              </p>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableBody>
                  <TableRow className="bg-secondary/50">
                    <TableCell className="px-2.5 py-1.5">
                      <span className="block font-semibold">Cao Thị Yến</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        NV-0013 · NV kho · Kho HN-1
                      </span>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right">
                      <StatusBadge tone="warn">Đang giữ PDA-HN-03</StatusBadge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-2.5 py-1.5">
                      <span className="block font-semibold">Cao Văn Thành</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        NV-0029 · NV kho · Kho HN-1
                      </span>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right">
                      <StatusBadge tone="neutral">Chưa có PDA</StatusBadge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="flex items-start gap-2 rounded-md border bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                <span className="font-semibold">Cao Thị Yến đang giữ PDA-HN-03.</span> Một tài khoản
                chỉ đăng nhập trên một PDA; gán mới sẽ gỡ PDA-HN-03 và buộc đăng nhập lại.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Ghi chú</span>
              <Input className="h-8" placeholder="Ví dụ: thay máy hỏng pin" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-3 py-2.5">
            <Button variant="ghost">
              Hủy bỏ <kbd className="rounded-sm bg-muted px-1 text-xs">Esc</kbd>
            </Button>
            <Button>Gán tài khoản</Button>
          </div>
        </aside>
      </div>
    </>
  );
}
