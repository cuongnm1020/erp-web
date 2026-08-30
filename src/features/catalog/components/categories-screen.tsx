'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Folder, GripVertical, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RowActions } from '@/components/data/row-actions';
import { StatusBadge } from '@/components/data/status-badge';
import { toast } from '@/components/ui/toaster';
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

interface CategoryNode {
  name: string;
  level: 1 | 2 | 3;
  count: number;
  expandable?: boolean;
  selected?: boolean;
}

interface BrandRow {
  name: string;
  owner: string;
  skuCount: number;
}

const SAMPLE_TREE: CategoryNode[] = [
  { name: 'Bút viết', level: 1, count: 86, expandable: true },
  { name: 'Bút bi', level: 2, count: 31, expandable: true },
  { name: 'Bút bi nắp đậy', level: 3, count: 18 },
  { name: 'Bút bi bấm', level: 3, count: 13, selected: true },
  { name: 'Bút dạ quang', level: 2, count: 12, expandable: true },
  { name: 'Bút lông', level: 2, count: 22, expandable: true },
  { name: 'Lông bảng', level: 3, count: 9 },
  { name: 'Lông dầu', level: 3, count: 13 },
  { name: 'Bút chì & ruột', level: 2, count: 21, expandable: true },
  { name: 'Giấy', level: 1, count: 54, expandable: true },
  { name: 'Giấy in', level: 2, count: 28, expandable: true },
  { name: 'Giấy ảnh', level: 2, count: 6, expandable: true },
  { name: 'Giấy note & decal', level: 2, count: 20, expandable: true },
  { name: 'Băng keo', level: 1, count: 17, expandable: true },
  { name: 'Sổ & tập', level: 1, count: 41, expandable: true },
  { name: 'Sổ tay', level: 2, count: 19, expandable: true },
  { name: 'Tập học sinh', level: 2, count: 22, expandable: true },
  { name: 'Kẹp & ghim', level: 1, count: 29, expandable: true },
  { name: 'Dụng cụ', level: 2, count: 8, expandable: true },
  { name: 'Mực in', level: 1, count: 35, expandable: true },
  { name: 'Laser', level: 2, count: 24, expandable: true },
  { name: 'Phun', level: 2, count: 11, expandable: true },
  { name: 'Bìa & file', level: 1, count: 26, expandable: true },
  { name: 'Dụng cụ học tập', level: 1, count: 42, expandable: true },
];

const SAMPLE_BRANDS: BrandRow[] = [
  { name: 'Thiên Long', owner: 'Thiên Long Group', skuCount: 64 },
  { name: 'Double A', owner: 'Double A (Thái Lan)', skuCount: 9 },
  { name: 'Deli', owner: 'Deli Group', skuCount: 58 },
  { name: 'Plus', owner: 'Plus Corporation', skuCount: 21 },
  { name: 'Campus', owner: 'Kokuyo VN', skuCount: 14 },
  { name: 'Klong', owner: 'Klong', skuCount: 11 },
  { name: 'Tiến Phát', owner: 'Tiến Phát', skuCount: 17 },
  { name: 'IK Plus', owner: 'IK Plus', skuCount: 5 },
  { name: 'HP', owner: 'HP Inc.', skuCount: 15 },
  { name: 'Canon', owner: 'Canon', skuCount: 12 },
  { name: 'Brother', owner: 'Brother', skuCount: 8 },
  { name: 'Epson', owner: 'Epson', skuCount: 10 },
  { name: 'Kokuyo', owner: 'Kokuyo VN', skuCount: 19 },
  { name: 'Hồng Hà', owner: 'Văn phòng phẩm Hồng Hà', skuCount: 27 },
];

const INDENT: Record<CategoryNode['level'], string> = {
  1: 'pl-2',
  2: 'pl-7',
  3: 'pl-12',
};

function FilterChip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-card text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function CategoriesScreen() {
  return (
    <>
      <PageHeader
        title="Danh mục & thương hiệu"
        description="24 danh mục (3 cấp) · 22 thương hiệu · 330 SKU đã gán"
        breadcrumb={[
          { label: 'Sản phẩm', href: '/catalog/products' },
          { label: 'Danh mục & thương hiệu' },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Plus /> Thêm thương hiệu
            </Button>
            <Button size="sm">
              <Plus /> Thêm danh mục
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[420px_1fr] items-start gap-3">
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Cây danh mục</span>
            <span className="text-xs text-muted-foreground">kéo để sắp xếp / đổi cha</span>
          </div>
          <ul className="py-1">
            {SAMPLE_TREE.map((node, i) => (
              <li key={`${node.name}-${i}`}>
                <button
                  type="button"
                  className={cn(
                    'flex h-7 w-full items-center gap-1.5 pr-3 text-left text-sm',
                    INDENT[node.level],
                    node.selected ? 'bg-secondary font-semibold text-primary' : 'hover:bg-muted',
                  )}
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="w-3 shrink-0 text-xs text-muted-foreground">
                    {node.expandable ? '▾' : ''}
                  </span>
                  <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{node.name}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {node.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            Số = SKU trực thuộc (không cộng dồn cấp con). Tối đa 3 cấp.
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <div className="flex h-7 w-56 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              <span>Tìm thương hiệu…</span>
            </div>
            <FilterChip active>Hoạt động</FilterChip>
            <FilterChip>Ngừng</FilterChip>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-40 px-2.5 text-xs">Thương hiệu</TableHead>
                  <TableHead className="px-2.5 text-xs">Nhà sản xuất / chủ sở hữu</TableHead>
                  <TableHead className="w-20 px-2.5 text-right text-xs">SKU</TableHead>
                  <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
                  <TableHead className="w-20 px-2.5 text-xs">
                    <span className="sr-only">Thao tác</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_BRANDS.map((b) => (
                  <TableRow key={b.name}>
                    <TableCell className="px-2.5 py-1.5 font-semibold">{b.name}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">{b.owner}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {b.skuCount}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone="ok">Hoạt động</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <RowActions
                        onEdit={() => toast.info('UI-first — form sửa thương hiệu chưa nối API')}
                        onDelete={() => toast.success(`Đã xóa thương hiệu ${b.name} (mẫu)`)}
                        itemName={`thương hiệu ${b.name}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">22 thương hiệu</div>
        </div>
      </div>
    </>
  );
}
