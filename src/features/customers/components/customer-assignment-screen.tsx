'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-1).
import { ChevronDown, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/data/status-badge';
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
import { formatDate, formatMoney } from '@/lib/format';

interface UnassignedRow {
  code: string;
  name: string;
  phone: string;
  level: string;
  tags: string[];
  createdAt: string;
  revenue12m: string;
  selected: boolean;
}

interface MemberRow {
  initials: string;
  name: string;
  badge?: 'leader' | 'new';
  holding: number;
  percent: number;
  picking?: boolean;
  assignable?: boolean;
}

const SAMPLE_UNASSIGNED: UnassignedRow[] = [
  {
    code: 'KH-013101',
    name: 'Cửa hàng Gia Bảo',
    phone: '0913 220 118',
    level: 'Đồng',
    tags: ['Bán lẻ'],
    createdAt: '2026-08-22',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013102',
    name: 'Tiệm photocopy Tuấn Kiệt',
    phone: '0987 445 020',
    level: 'Đồng',
    tags: ['Photocopy'],
    createdAt: '2026-08-22',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013096',
    name: 'Văn phòng phẩm Thảo Nguyên',
    phone: '0932 006 771',
    level: 'Đồng',
    tags: ['Đại lý', 'Hà Đông'],
    createdAt: '2026-08-21',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013090',
    name: 'Công ty TNHH Nội thất Trường An',
    phone: '024 3355 8102',
    level: 'Đồng',
    tags: ['Doanh nghiệp'],
    createdAt: '2026-08-21',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013088',
    name: 'Nhà sách Trí Đức',
    phone: '0968 771 203',
    level: 'Đồng',
    tags: ['Nhà sách'],
    createdAt: '2026-08-21',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013085',
    name: 'Trường Mầm non Hoa Sen',
    phone: '024 3768 4411',
    level: 'Đồng',
    tags: ['Trường học'],
    createdAt: '2026-08-20',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013082',
    name: 'Cửa hàng Đại Phát',
    phone: '0918 302 415',
    level: 'Đồng',
    tags: ['Bán lẻ'],
    createdAt: '2026-08-20',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013079',
    name: 'Tiệm in ấn Song Long',
    phone: '0977 128 665',
    level: 'Đồng',
    tags: ['Photocopy'],
    createdAt: '2026-08-19',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013075',
    name: 'Công ty CP Kiến trúc Ánh Dương',
    phone: '024 3216 9977',
    level: 'Đồng',
    tags: ['Doanh nghiệp'],
    createdAt: '2026-08-19',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013071',
    name: 'Văn phòng phẩm Bình Minh',
    phone: '0904 512 380',
    level: 'Đồng',
    tags: ['Đại lý', 'Long Biên'],
    createdAt: '2026-08-18',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013068',
    name: 'Cửa hàng Phúc Lộc',
    phone: '0936 704 221',
    level: 'Đồng',
    tags: ['Bán lẻ'],
    createdAt: '2026-08-18',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013064',
    name: 'Trung tâm luyện thi Thăng Long',
    phone: '0912 990 456',
    level: 'Đồng',
    tags: ['Trường học'],
    createdAt: '2026-08-17',
    revenue12m: '0',
    selected: true,
  },
  {
    code: 'KH-013060',
    name: 'Cửa hàng Kim Ngân',
    phone: '0983 116 902',
    level: 'Đồng',
    tags: ['Bán lẻ'],
    createdAt: '2026-08-17',
    revenue12m: '0',
    selected: false,
  },
  {
    code: 'KH-013055',
    name: 'Công ty TNHH Vận tải Tiến Đạt',
    phone: '024 3556 7008',
    level: 'Đồng',
    tags: ['Doanh nghiệp'],
    createdAt: '2026-08-16',
    revenue12m: '0',
    selected: false,
  },
  {
    code: 'KH-013049',
    name: 'Tiệm photocopy Minh Đức',
    phone: '0975 233 810',
    level: 'Đồng',
    tags: ['Photocopy'],
    createdAt: '2026-08-15',
    revenue12m: '0',
    selected: false,
  },
  {
    code: 'KH-013044',
    name: 'Nhà sách Ngọc Hà',
    phone: '0967 480 132',
    level: 'Đồng',
    tags: ['Nhà sách'],
    createdAt: '2026-08-14',
    revenue12m: '0',
    selected: false,
  },
];

const SAMPLE_MEMBERS: MemberRow[] = [
  { initials: 'TB', name: 'Trần Thị Bình', badge: 'leader', holding: 96, percent: 24 },
  { initials: 'LH', name: 'Lê Thu Hà', holding: 152, percent: 38, picking: true, assignable: true },
  { initials: 'NA', name: 'Nguyễn Văn An', holding: 312, percent: 78 },
  { initials: 'PL', name: 'Phạm Đức Long', holding: 281, percent: 70 },
  { initials: 'ĐT', name: 'Đỗ Thanh Tùng', holding: 248, percent: 62 },
  { initials: 'VH', name: 'Vũ Ngọc Huyền', badge: 'new', holding: 0, percent: 0, assignable: true },
];

export function CustomerAssignmentScreen() {
  return (
    <>
      <PageHeader
        title="Phân công khách hàng"
        description="Team Hà Nội · 6 thành viên · 1.240 khách trong team · 48 chưa phân"
        breadcrumb={[{ label: 'Khách hàng', href: '/crm/customers' }, { label: 'Phân công' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Nhập phân công từ CSV
            </Button>
            <Button variant="outline" size="sm">
              Lịch sử phân công
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[1fr_340px] items-start gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex h-9 border-b">
            <span className="-mb-px flex items-center gap-1.5 border-b-2 border-primary px-3 text-sm font-semibold text-primary">
              Chưa phân{' '}
              <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground">
                48
              </span>
            </span>
            <span className="flex items-center gap-1.5 px-3 text-sm text-muted-foreground">
              Đã phân trong team{' '}
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                1.192
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-1.5">
            <div className="relative w-60">
              <Search
                className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input className="h-7 pl-7 text-xs" placeholder="Tìm theo tên, SĐT…" />
            </div>
            {['Nguồn: Web đăng ký', 'Quận/huyện', 'Cấp độ'].map((c) => (
              <button
                key={c}
                type="button"
                className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-input bg-card px-2 text-xs"
              >
                {c}
                <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>

          <div className="rounded-md border bg-card">
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-8 px-2.5">
                      <Checkbox checked="indeterminate" aria-label="Chọn tất cả" />
                    </TableHead>
                    <TableHead className="px-2.5 text-xs">Mã KH</TableHead>
                    <TableHead className="px-2.5 text-xs">Tên khách hàng</TableHead>
                    <TableHead className="px-2.5 text-xs">SĐT</TableHead>
                    <TableHead className="px-2.5 text-xs">Cấp độ</TableHead>
                    <TableHead className="px-2.5 text-xs">Tag</TableHead>
                    <TableHead className="px-2.5 text-xs">Tạo lúc</TableHead>
                    <TableHead className="px-2.5 text-right text-xs">DT 12 tháng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_UNASSIGNED.map((c) => (
                    <TableRow key={c.code} className={c.selected ? 'bg-secondary' : undefined}>
                      <TableCell className="px-2.5 py-1.5">
                        <Checkbox checked={c.selected} aria-label={`Chọn ${c.code}`} />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="max-w-64 truncate px-2.5 py-1.5">{c.name}</TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">{c.phone}</TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <StatusBadge tone="neutral">{c.level}</StatusBadge>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="mr-1 inline-block rounded-sm bg-muted px-1.5 text-xs text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">{formatDate(c.createdAt)}</TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {formatMoney(c.revenue12m, { unit: '' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-3 border-t border-primary bg-secondary px-3 py-1.5">
              <span className="text-sm font-semibold text-primary">12 đã chọn</span>
              <button type="button" className="text-sm text-primary hover:underline">
                Bỏ chọn
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                  Gắn tag <ChevronDown aria-hidden />
                </Button>
                <Button size="sm" className="h-7 px-2 text-xs">
                  Gán cho <ChevronDown aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
            <span className="font-semibold">Thành viên team Hà Nội</span>
            <span className="text-xs text-muted-foreground">KH đang giữ</span>
          </header>
          <ul>
            {SAMPLE_MEMBERS.map((m) => (
              <li
                key={m.name}
                className={
                  m.picking
                    ? 'flex items-center gap-2.5 border-b bg-secondary px-3 py-2.5'
                    : 'flex items-center gap-2.5 border-b px-3 py-2.5'
                }
              >
                <span
                  className={
                    m.badge === 'new'
                      ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground'
                      : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary'
                  }
                >
                  {m.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {m.name}
                    {m.badge === 'leader' ? <StatusBadge tone="brand">Leader</StatusBadge> : null}
                    {m.badge === 'new' ? <StatusBadge tone="neutral">Mới vào</StatusBadge> : null}
                    {m.picking ? (
                      <span className="text-sm font-normal text-muted-foreground">· đang chọn</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${m.percent}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {m.holding}
                    </span>
                  </div>
                </div>
                {m.assignable ? (
                  <Button
                    variant={m.picking ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                  >
                    Gán 12
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="px-3 py-2.5 text-xs text-muted-foreground">
            Thanh tải = số KH đang giữ so với người nhiều nhất (312). Cân nhắc dồn khách mới cho Vũ
            Ngọc Huyền.
          </p>
        </div>
      </div>

      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Gán là thao tác đảo ngược được — làm luôn rồi cho Hoàn tác 10 giây, không hỏi confirm. Chỉ
        leader thấy màn này; member không có mục Phân công trong sidebar.
      </p>
    </>
  );
}
