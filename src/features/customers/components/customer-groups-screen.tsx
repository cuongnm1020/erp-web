'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-1).
import { ChevronDown, Info, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RowActions } from '@/components/data/row-actions';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
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

interface GroupRow {
  name: string;
  detail: string;
  count: string;
}

interface LevelRow {
  level: string;
  tone: StatusTone;
  plain?: boolean;
  condition: string;
  perk: string;
  count: string;
}

interface TagChip {
  name: string;
  count: string;
  active?: boolean;
}

const SAMPLE_GROUPS: GroupRow[] = [
  { name: 'Đại lý', detail: 'Bảng giá: Đại lý miền Bắc · hạn mức 50.000.000', count: '418' },
  { name: 'Doanh nghiệp', detail: 'Bảng giá: Doanh nghiệp · hạn mức 100.000.000', count: '356' },
  {
    name: 'Trường học',
    detail: 'Bảng giá: Dự án · hạn mức 80.000.000 · công nợ 45 ngày',
    count: '204',
  },
  { name: 'Nhà sách', detail: 'Bảng giá: Đại lý miền Bắc · hạn mức 60.000.000', count: '112' },
  { name: 'Bán lẻ', detail: 'Bảng giá: Mặc định · hạn mức 20.000.000', count: '150' },
];

const SAMPLE_LEVELS: LevelRow[] = [
  {
    level: 'Kim cương',
    tone: 'brand',
    condition: '≥ 1.000.000.000',
    perk: 'CK thêm 3% · freeship · ưu tiên hàng khan',
    count: '18',
  },
  {
    level: 'Vàng',
    tone: 'warn',
    condition: '≥ 300.000.000',
    perk: 'CK thêm 2% · freeship đơn từ 2.000.000',
    count: '96',
  },
  { level: 'Bạc', tone: 'neutral', condition: '≥ 100.000.000', perk: 'CK thêm 1%', count: '324' },
  { level: 'Đồng', tone: 'neutral', condition: '< 100.000.000', perk: '—', count: '784' },
  {
    level: 'Chưa xếp hạng',
    tone: 'neutral',
    plain: true,
    condition: 'KH mới, chưa đủ 3 tháng dữ liệu',
    perk: '—',
    count: '18',
  },
];

const SAMPLE_TAGS: TagChip[] = [
  { name: 'Đại lý', count: '312' },
  { name: 'Doanh nghiệp', count: '298' },
  { name: 'Trường học', count: '186' },
  { name: 'Nhà sách', count: '98' },
  { name: 'Bán lẻ', count: '240' },
  { name: 'Photocopy', count: '74' },
  { name: 'Ký HĐ', count: '122' },
  { name: 'Chuỗi', count: '31' },
  { name: 'Hoàn Kiếm', count: '64' },
  { name: 'Cầu Giấy', count: '58' },
  { name: 'Đống Đa', count: '51' },
  { name: 'Long Biên', count: '44' },
  { name: 'Hà Đông', count: '39' },
  { name: 'Mùa tựu trường', count: '210', active: true },
  { name: 'Dự án thầu', count: '26' },
  { name: 'Khách VIP cũ', count: '12' },
];

export function CustomerGroupsScreen() {
  return (
    <>
      <PageHeader
        title="Nhóm khách hàng · cấp độ · tag"
        description="Nhóm quyết định bảng giá và hạn mức mặc định · cấp độ tự tính theo doanh thu · tag để lọc tự do"
        breadcrumb={[
          { label: 'Khách hàng', href: '/crm/customers' },
          { label: 'Nhóm · cấp độ · tag' },
        ]}
        actions={
          <Button variant="outline" size="sm">
            Lịch sử thay đổi
          </Button>
        }
      />

      <div className="grid grid-cols-[1fr_1.3fr_1fr] items-start gap-3">
        <div className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            <span>Nhóm khách hàng (5)</span>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs font-normal">
              <Plus aria-hidden />
              Thêm nhóm
            </Button>
          </header>
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="px-2.5 text-xs">Nhóm</TableHead>
                <TableHead className="w-16 px-2.5 text-right text-xs">Số KH</TableHead>
                <TableHead className="w-20 px-2.5 text-xs">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_GROUPS.map((g) => (
                <TableRow key={g.name}>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.detail}</div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{g.count}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <RowActions
                      onEdit={() => toast.info('UI-first — form sửa nhóm chưa nối API')}
                      onDelete={() => toast.success(`Đã xóa nhóm ${g.name} (mẫu)`)}
                      itemName={`nhóm ${g.name}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Một KH thuộc đúng một nhóm. Đổi nhóm → đổi bảng giá từ đơn kế tiếp.
          </p>
        </div>

        <div className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            <span>Cấp độ — quy tắc tự nâng hạng</span>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs font-normal">
              Sửa quy tắc
            </Button>
          </header>
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-28 px-2.5 text-xs">Cấp độ</TableHead>
                <TableHead className="px-2.5 text-xs">Điều kiện (DT 12 tháng)</TableHead>
                <TableHead className="px-2.5 text-xs">Ưu đãi</TableHead>
                <TableHead className="w-16 px-2.5 text-right text-xs">Số KH</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LEVELS.map((l) => (
                <TableRow key={l.level}>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={l.tone} className={l.plain ? 'font-normal' : undefined}>
                      {l.level}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 tabular-nums">{l.condition}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{l.perk}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{l.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-3 py-2.5">
            <div className="flex items-start gap-2.5 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Hạng tính lại đêm 01 hằng tháng theo doanh thu 12 tháng gần nhất. Hạ hạng có độ trễ
                1 kỳ để tránh nhảy hạng liên tục. Lần chạy gần nhất: 01/08/2026.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            <span>Tag (24)</span>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs font-normal">
              <Plus aria-hidden />
              Thêm tag
            </Button>
          </header>
          <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
            {SAMPLE_TAGS.map((t) => (
              <button
                key={t.name}
                type="button"
                className={
                  t.active
                    ? 'inline-flex h-7 items-center gap-1 rounded-md border border-primary bg-secondary px-2 text-xs font-semibold text-primary'
                    : 'inline-flex h-7 items-center gap-1 rounded-md border border-input bg-card px-2 text-xs'
                }
              >
                {t.name}{' '}
                <span className={t.active ? undefined : 'text-muted-foreground'}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="border-t px-3 py-2.5">
            <p className="mb-1.5 text-sm font-semibold">Tag đang chọn: Mùa tựu trường</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => toast.info('UI-first — form đổi tên tag chưa nối API')}
              >
                Đổi tên
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                Gộp vào tag khác <ChevronDown aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-destructive px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => toast.success('Đã xóa tag Mùa tựu trường (mẫu)')}
              >
                Xóa tag
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Xóa tag chỉ gỡ nhãn khỏi 210 KH, không xóa khách. Có hoàn tác 10 giây.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Tách 3 khái niệm — nhóm (một-một, quyết định giá), cấp độ (tự tính, chỉ đọc), tag
        (nhiều-nhiều, lọc tự do).
      </p>
    </>
  );
}
