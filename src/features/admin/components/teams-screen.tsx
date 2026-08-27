'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { AlertTriangle, Folder, Info, Search, Users, X } from 'lucide-react';
import { StatusBadge } from '@/components/data/status-badge';
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
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

interface TreeNode {
  name: string;
  kind: 'department' | 'team';
  count: number;
  active?: boolean;
}

interface MemberRow {
  code: string;
  name: string;
  role: string;
  isLeader: boolean;
  assignedCustomers: number;
  joinedAt: string;
}

interface CandidateRow {
  code: string;
  name: string;
  currentTeam: string | null;
  selected?: boolean;
}

const SAMPLE_TREE: TreeNode[] = [
  { name: 'Ban giám đốc', kind: 'department', count: 2 },
  { name: 'Kinh doanh', kind: 'department', count: 14 },
  { name: 'Sale Hà Nội', kind: 'team', count: 6, active: true },
  { name: 'Sale HCM', kind: 'team', count: 5 },
  { name: 'Dự án trường học 2026', kind: 'team', count: 3 },
  { name: 'CSKH', kind: 'department', count: 5 },
  { name: 'CSKH miền Bắc', kind: 'team', count: 2 },
  { name: 'CSKH miền Nam', kind: 'team', count: 3 },
  { name: 'Kho vận', kind: 'department', count: 13 },
  { name: 'Kho HN-1', kind: 'team', count: 7 },
  { name: 'Kho HCM-2', kind: 'team', count: 6 },
  { name: 'Kế toán', kind: 'department', count: 3 },
  { name: 'Mua hàng', kind: 'department', count: 2 },
];

const SAMPLE_MEMBERS: MemberRow[] = [
  {
    code: 'NV-0002',
    name: 'Trần Thị Bình',
    role: 'Sale leader',
    isLeader: true,
    assignedCustomers: 22,
    joinedAt: '2023-01-15T00:00:00+07:00',
  },
  {
    code: 'NV-0003',
    name: 'Nguyễn Văn An',
    role: 'Sale',
    isLeader: false,
    assignedCustomers: 38,
    joinedAt: '2024-03-04T00:00:00+07:00',
  },
  {
    code: 'NV-0004',
    name: 'Phạm Thu Hà',
    role: 'Sale',
    isLeader: false,
    assignedCustomers: 41,
    joinedAt: '2024-05-10T00:00:00+07:00',
  },
  {
    code: 'NV-0019',
    name: 'Hồ Thị Ngọc',
    role: 'Sale',
    isLeader: false,
    assignedCustomers: 29,
    joinedAt: '2025-01-02T00:00:00+07:00',
  },
  {
    code: 'NV-0021',
    name: 'Nguyễn Thị Hường',
    role: 'Sale',
    isLeader: false,
    assignedCustomers: 0,
    joinedAt: '2025-03-15T00:00:00+07:00',
  },
  {
    code: 'NV-0025',
    name: 'Lê Văn Minh',
    role: 'Sale',
    isLeader: false,
    assignedCustomers: 12,
    joinedAt: '2026-08-01T00:00:00+07:00',
  },
];

const SAMPLE_CANDIDATES: CandidateRow[] = [
  { code: 'NV-0020', name: 'Dương Văn Quang', currentTeam: 'Sale HCM', selected: true },
  { code: 'NV-0001', name: 'Lê Quang Huy', currentTeam: null },
  { code: 'NV-0031', name: 'Trần Quang Vinh', currentTeam: 'Mua hàng' },
];

function Toggle({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cn(
        'inline-flex h-4 w-7 items-center rounded-full px-0.5 transition-colors',
        on ? 'justify-end bg-primary' : 'justify-start bg-border',
      )}
    >
      <span className="h-3 w-3 rounded-full bg-background" />
    </span>
  );
}

export function TeamsScreen() {
  return (
    <>
      <PageHeader
        title="Phòng ban & team"
        description="7 phòng ban · 8 team · 57 nhân viên"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Phòng ban & team' }]}
        actions={
          <>
            <Button variant="outline">Thêm phòng ban</Button>
            <Button>Thêm team</Button>
          </>
        }
      />
      <div className="grid items-start gap-3 xl:grid-cols-[260px_1fr_360px]">
        <section className="rounded-md border bg-card">
          <h2 className="border-b px-3 py-2 text-sm font-semibold">Cơ cấu</h2>
          <nav className="py-1">
            {SAMPLE_TREE.map((n) => (
              <button
                key={n.name}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted',
                  n.kind === 'team' && 'pl-7',
                  n.active && 'bg-secondary font-semibold text-primary',
                )}
              >
                {n.kind === 'department' ? (
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="truncate">{n.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{n.count}</span>
              </button>
            ))}
          </nav>
        </section>

        <div className="space-y-3">
          <section className="rounded-md border bg-card p-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Tên team</span>
                <Input defaultValue="Sale Hà Nội" className="h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Phòng ban</span>
                <Input defaultValue="Kinh doanh" className="h-8" readOnly />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Mã</span>
                <Input defaultValue="TEAM-SALE-HN" className="h-8 bg-muted font-mono" readOnly />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Khách hàng đã phân</span>
                <p className="flex h-8 items-center text-sm">
                  142 khách ·&nbsp;
                  <button type="button" className="text-primary hover:underline">
                    mở phân công
                  </button>
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">
                Thành viên <span className="font-normal text-muted-foreground">· 6 · 1 leader</span>
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  Chuyển team
                </Button>
                <Button size="sm">Thêm thành viên</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="w-8 px-2.5">
                      <Checkbox aria-label="Chọn tất cả" />
                    </TableHead>
                    <TableHead className="px-2.5">Mã NV</TableHead>
                    <TableHead className="px-2.5">Họ tên</TableHead>
                    <TableHead className="px-2.5">Vai trò</TableHead>
                    <TableHead className="px-2.5">Leader</TableHead>
                    <TableHead className="px-2.5 text-right">KH được phân</TableHead>
                    <TableHead className="px-2.5 text-right">Vào team</TableHead>
                    <TableHead className="px-2.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_MEMBERS.map((m) => (
                    <TableRow key={m.code}>
                      <TableCell className="px-2.5 py-1.5">
                        <Checkbox aria-label={`Chọn ${m.code}`} />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{m.code}</TableCell>
                      <TableCell className="px-2.5 py-1.5 font-semibold">{m.name}</TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <StatusBadge tone="neutral">{m.role}</StatusBadge>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <Toggle on={m.isLeader} label={`Leader: ${m.name}`} />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {m.assignedCustomers}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                        {formatDate(m.joinedAt)}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <button type="button" className="text-primary hover:underline">
                          Gỡ khỏi team
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border-t p-3">
              <div className="flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Leader thấy toàn bộ khách của team và duyệt đơn vượt trần của thành viên. Một team
                  có thể có nhiều leader; bật/tắt có hiệu lực ngay.
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Thêm thành viên vào Sale Hà Nội</h2>
            <X className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-3 p-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Tìm nhân viên</span>
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input defaultValue="quang" className="h-8 pl-8" />
              </div>
              <p className="text-xs text-muted-foreground">
                Chỉ hiện nhân viên chưa thuộc team này
              </p>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="w-8 px-2.5" />
                    <TableHead className="px-2.5">Nhân viên</TableHead>
                    <TableHead className="px-2.5">Team hiện tại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_CANDIDATES.map((c) => (
                    <TableRow key={c.code} className={cn(c.selected && 'bg-secondary/50')}>
                      <TableCell className="px-2.5 py-1.5">
                        <Checkbox checked={c.selected ?? false} aria-label={`Chọn ${c.name}`} />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <span className="block font-semibold">{c.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">{c.currentTeam ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Vai trò trong team</span>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <Checkbox checked aria-label="Thành viên" />
                  Thành viên
                </label>
                <label className="flex items-center gap-1.5">
                  <Checkbox aria-label="Leader" />
                  Leader
                </label>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                <span className="font-semibold">Dương Văn Quang đang ở Sale HCM.</span> Thêm vào đây
                = thuộc 2 team. 17 khách đang phân cho anh ở Sale HCM giữ nguyên.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-3 py-2.5">
            <Button variant="ghost">
              Hủy bỏ <kbd className="rounded-sm bg-muted px-1 text-xs">Esc</kbd>
            </Button>
            <Button>Thêm 1 thành viên</Button>
          </div>
        </aside>
      </div>
    </>
  );
}
