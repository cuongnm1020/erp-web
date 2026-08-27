'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-1).
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

interface DuplicatePair {
  phone: string;
  names: string;
  active?: boolean;
}

interface CompareRow {
  field: string;
  keep: string;
  keepEmpty?: boolean;
  merge: string;
  keepSelected: 'keep' | 'merge' | 'none';
}

const SAMPLE_PAIRS: DuplicatePair[] = [
  { phone: '0912 345 678', names: 'Cửa hàng Minh Tâm · Minh Tâm HN (mới tạo 23/08)', active: true },
  { phone: '0987 445 020', names: 'Tiệm photocopy Tuấn Kiệt · CH Tuấn Kiệt' },
  { phone: '0932 006 771', names: 'VPP Thảo Nguyên · Thảo Nguyên Hà Đông' },
  { phone: '0968 771 203', names: 'Nhà sách Trí Đức · Trí Đức Book' },
  { phone: '0904 512 380', names: 'VPP Bình Minh · Bình Minh Long Biên' },
  { phone: '0977 128 665', names: 'Tiệm in Song Long · In ấn S.Long' },
  { phone: '0936 704 221', names: 'Cửa hàng Phúc Lộc · Phúc Lộc 2' },
  { phone: '0983 116 902', names: 'Cửa hàng Kim Ngân · Kim Ngân Store' },
];

const SAMPLE_COMPARE: CompareRow[] = [
  { field: 'Tên', keep: 'Cửa hàng Minh Tâm', merge: 'Minh Tâm HN', keepSelected: 'keep' },
  {
    field: 'Email',
    keep: '(trống)',
    keepEmpty: true,
    merge: 'minhtam.hn@gmail.com',
    keepSelected: 'merge',
  },
  {
    field: 'Địa chỉ giao',
    keep: 'Số 12 Lê Lợi, Hoàn Kiếm (+1 địa chỉ)',
    merge: 'Số 15 Hàng Bông, Hoàn Kiếm',
    keepSelected: 'keep',
  },
  {
    field: 'Nhóm / cấp độ',
    keep: 'Đại lý · Bạc',
    merge: 'Bán lẻ · chưa xếp hạng',
    keepSelected: 'keep',
  },
  {
    field: 'Người phụ trách',
    keep: 'Nguyễn Văn An',
    merge: 'Nguyễn Văn An',
    keepSelected: 'keep',
  },
  {
    field: 'Đồng ý marketing',
    keep: 'Email + SMS đồng ý (nguồn: form)',
    merge: 'Chưa hỏi',
    keepSelected: 'keep',
  },
];

function Radio({ on }: { on?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        on
          ? 'mr-1.5 inline-block h-3.5 w-3.5 rounded-full border-4 border-primary bg-background align-middle'
          : 'mr-1.5 inline-block h-3.5 w-3.5 rounded-full border border-input bg-background align-middle'
      }
    />
  );
}

export function MergeDuplicatesScreen() {
  return (
    <>
      <PageHeader
        title="Gộp khách trùng theo SĐT"
        description="8 cặp trùng trong team Hà Nội · quét lại mỗi đêm · gộp xong đơn và công nợ dồn về bản ghi giữ lại"
        breadcrumb={[{ label: 'Khách hàng', href: '/crm/customers' }, { label: 'Gộp khách trùng' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Quét lại ngay
            </Button>
            <Button variant="outline" size="sm">
              Bỏ qua cặp đã xem
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[360px_1fr] items-start gap-3">
        <div className="rounded-md border bg-card">
          <header className="border-b px-3 py-2 text-sm font-semibold">Cặp trùng (8)</header>
          <ul>
            {SAMPLE_PAIRS.map((p) => (
              <li
                key={p.phone}
                className={
                  p.active
                    ? 'border-b border-l-2 border-l-primary bg-secondary px-3 py-2 last:border-b-0'
                    : 'border-b px-3 py-2 last:border-b-0'
                }
              >
                <div className="font-mono text-xs font-semibold">{p.phone}</div>
                <div className="text-xs text-muted-foreground">{p.names}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
            <span className="font-semibold">
              So sánh cặp <span className="font-mono text-xs font-normal">0912 345 678</span>
            </span>
            <span className="text-xs text-muted-foreground">
              chọn giá trị giữ lại cho từng trường
            </span>
          </header>
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-36 px-2.5 text-xs">Trường</TableHead>
                <TableHead className="px-2.5 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusBadge tone="ok">Giữ lại</StatusBadge>
                    <span className="font-mono text-primary">KH-004512</span>
                  </span>
                </TableHead>
                <TableHead className="px-2.5 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusBadge tone="neutral">Gộp vào</StatusBadge>
                    <span className="font-mono">KH-013207</span>
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                  {SAMPLE_COMPARE[0]?.field}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <Radio on />
                  <span className="font-semibold">Cửa hàng Minh Tâm</span>
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <Radio />
                  Minh Tâm HN
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">SĐT</TableCell>
                <TableCell className="px-2.5 py-1.5" colSpan={2}>
                  <span className="font-mono text-xs">0912 345 678</span>{' '}
                  <span className="text-muted-foreground">· giống nhau</span>
                </TableCell>
              </TableRow>
              {SAMPLE_COMPARE.slice(1).map((row) => (
                <TableRow key={row.field}>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{row.field}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <Radio on={row.keepSelected === 'keep'} />
                    <span className={row.keepEmpty ? 'text-muted-foreground' : undefined}>
                      {row.keep}
                    </span>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <Radio on={row.keepSelected === 'merge'} />
                    {row.merge}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">Đơn hàng</TableCell>
                <TableCell className="px-2.5 py-1.5 tabular-nums">
                  47 đơn · 184.250.000 (12 tháng)
                </TableCell>
                <TableCell className="px-2.5 py-1.5 tabular-nums">1 đơn · 2.140.000</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">Công nợ</TableCell>
                <TableCell className="px-2.5 py-1.5 tabular-nums">12.400.000</TableCell>
                <TableCell className="px-2.5 py-1.5 tabular-nums">0</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="flex items-center gap-3 border-t px-3 py-2.5">
            <p className="text-sm text-muted-foreground">
              Sau khi gộp:{' '}
              <span className="font-semibold text-foreground">48 đơn · công nợ 12.400.000</span> ·
              toàn bộ lịch sử, ticket, địa chỉ dồn về{' '}
              <span className="font-mono text-xs">KH-004512</span>.{' '}
              <span className="font-mono text-xs">KH-013207</span> bị vô hiệu, mọi link cũ trỏ về
              bản giữ lại.
            </p>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm">
                Bỏ qua cặp này
              </Button>
              <Button size="sm">Gộp và giữ KH-004512</Button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Gộp là thao tác không đảo ngược — chứng từ đã ghi sổ không thể tách lại về hai khách, nên
        bước xác nhận dùng confirm dialog thay vì hoàn tác.
      </p>
    </>
  );
}
