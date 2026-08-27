'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Columns3, Plus, Search } from 'lucide-react';
import Link from 'next/link';
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

interface SupplierRow {
  code: string;
  name: string;
  taxCode: string;
  contact: string;
  phone: string;
  terms: string;
  openPo: number;
  payable: string;
}

const SAMPLE_SUPPLIERS: SupplierRow[] = [
  {
    code: 'NCC-0001',
    name: 'Công ty CP Tập đoàn Thiên Long',
    taxCode: '0301464896',
    contact: 'Nguyễn Thị Thu Hà',
    phone: '028 3750 5555',
    terms: 'Net 30',
    openPo: 3,
    payable: '412500000',
  },
  {
    code: 'NCC-0002',
    name: 'Công ty TNHH Double A Việt Nam',
    taxCode: '0302789012',
    contact: 'Somchai P.',
    phone: '028 3822 1188',
    terms: 'Net 45',
    openPo: 1,
    payable: '186000000',
  },
  {
    code: 'NCC-0003',
    name: 'Deli Việt Nam',
    taxCode: '0315678901',
    contact: 'Trần Văn Long',
    phone: '024 3736 9090',
    terms: 'Net 30',
    openPo: 2,
    payable: '97800000',
  },
  {
    code: 'NCC-0004',
    name: 'Công ty TNHH Tiến Phát Tape',
    taxCode: '0312345678',
    contact: 'Lê Minh Phát',
    phone: '028 3875 1234',
    terms: 'Trả ngay',
    openPo: 0,
    payable: '0',
  },
  {
    code: 'NCC-0005',
    name: 'Kokuyo Việt Nam',
    taxCode: '0304567890',
    contact: 'Phạm Hồng Nhung',
    phone: '024 3934 5566',
    terms: 'Net 30',
    openPo: 1,
    payable: '54200000',
  },
  {
    code: 'NCC-0006',
    name: 'Công ty TNHH Plus Việt Nam',
    taxCode: '0309876543',
    contact: 'Đỗ Quang Minh',
    phone: '028 3844 7788',
    terms: 'Net 60',
    openPo: 0,
    payable: '28750000',
  },
  {
    code: 'NCC-0007',
    name: 'Công ty CP Văn phòng phẩm Hồng Hà',
    taxCode: '0100100216',
    contact: 'Vũ Thị Lan',
    phone: '024 3825 4433',
    terms: 'Net 30',
    openPo: 2,
    payable: '143900000',
  },
  {
    code: 'NCC-0008',
    name: 'Công ty TNHH TM Mực in Sao Việt',
    taxCode: '0311223344',
    contact: 'Bùi Đức Anh',
    phone: '028 3811 2233',
    terms: 'Net 15',
    openPo: 1,
    payable: '221400000',
  },
  {
    code: 'NCC-0009',
    name: 'HP Việt Nam (qua Synnex FPT)',
    taxCode: '0100107070',
    contact: 'Ngô Thanh Tùng',
    phone: '024 7300 8888',
    terms: 'Net 30',
    openPo: 0,
    payable: '0',
  },
  {
    code: 'NCC-0010',
    name: 'Công ty TNHH Canon Marketing VN',
    taxCode: '0302334455',
    contact: 'Hoàng Lan Anh',
    phone: '028 3820 0466',
    terms: 'Net 30',
    openPo: 1,
    payable: '118000000',
  },
  {
    code: 'NCC-0011',
    name: 'Klong Stationery',
    taxCode: '0316677889',
    contact: 'Trịnh Văn Khang',
    phone: '024 3558 1122',
    terms: 'Trả ngay',
    openPo: 0,
    payable: '12600000',
  },
  {
    code: 'NCC-0012',
    name: 'Công ty TNHH Giấy IK Việt Nam',
    taxCode: '0305544332',
    contact: 'Nguyễn Hữu Tài',
    phone: '028 3910 9988',
    terms: 'Net 45',
    openPo: 2,
    payable: '96000000',
  },
  {
    code: 'NCC-0016',
    name: 'Công ty TNHH 3M Việt Nam',
    taxCode: '0300725818',
    contact: 'Nguyễn Đức Hòa',
    phone: '028 3932 7777',
    terms: 'Net 45',
    openPo: 1,
    payable: '61200000',
  },
  {
    code: 'NCC-0018',
    name: 'Epson Việt Nam',
    taxCode: '0314455667',
    contact: 'Phan Anh Tuấn',
    phone: '028 3827 8800',
    terms: 'Net 30',
    openPo: 1,
    payable: '87000000',
  },
  {
    code: 'NCC-0022',
    name: 'Cơ sở Văn phòng phẩm Phú Thịnh',
    taxCode: '8123456789',
    contact: 'Nguyễn Phú Thịnh',
    phone: '0912 888 666',
    terms: 'Trả ngay',
    openPo: 0,
    payable: '3200000',
  },
];

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-card px-2 text-sm text-foreground"
    >
      {children}
    </button>
  );
}

const NUM_CELL = 'px-2.5 py-1.5 text-right tabular-nums';

export function SupplierListScreen() {
  return (
    <>
      <PageHeader
        title="Nhà cung cấp"
        description="22 NCC hoạt động · 17 PO đang mở · tổng phải trả 1.629.950.000"
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Nhà cung cấp' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button size="sm">
              <Plus /> Thêm nhà cung cấp
            </Button>
          </>
        }
      />

      <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-64 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Tìm theo mã, tên, MST, SĐT…</span>
        </div>
        <FilterChip>Điều khoản: Tất cả ▾</FilterChip>
        <FilterChip>Có PO đang mở</FilterChip>
        <FilterChip>Có công nợ</FilterChip>
        <FilterChip>Ngừng hợp tác</FilterChip>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Columns3 className="h-3.5 w-3.5" /> Cột ▾
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-24 px-2.5 text-xs">Mã</TableHead>
                <TableHead className="px-2.5 text-xs">Tên nhà cung cấp</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">MST</TableHead>
                <TableHead className="w-40 px-2.5 text-xs">Liên hệ</TableHead>
                <TableHead className="w-32 px-2.5 text-xs">SĐT</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">Điều khoản TT</TableHead>
                <TableHead className="w-24 px-2.5 text-right text-xs">PO đang mở</TableHead>
                <TableHead className="w-36 px-2.5 text-right text-xs">Phải trả</TableHead>
                <TableHead className="w-24 px-2.5 text-xs">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_SUPPLIERS.map((s) => (
                <TableRow key={s.code}>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                    <Link
                      href={`/catalog/suppliers/${s.code}`}
                      className="text-primary hover:underline"
                    >
                      {s.code}
                    </Link>
                  </TableCell>
                  <TableCell
                    className="max-w-72 truncate px-2.5 py-1.5 font-semibold"
                    title={s.name}
                  >
                    {s.name}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{s.taxCode}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{s.contact}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{s.phone}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{s.terms}</TableCell>
                  <TableCell className={cn(NUM_CELL, s.openPo === 0 && 'text-muted-foreground')}>
                    {s.openPo}
                  </TableCell>
                  <TableCell
                    className={cn(
                      NUM_CELL,
                      s.payable === '0' ? 'text-muted-foreground' : 'font-semibold',
                    )}
                  >
                    {formatMoney(s.payable, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone="ok">Hoạt động</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–22 / 22</span>
          <span className="ml-auto">40 dòng/trang ▾</span>
        </div>
      </div>
    </>
  );
}
