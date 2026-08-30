'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-1).
import { ChevronDown, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RowActions } from '@/components/data/row-actions';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
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

type ConsentValue = 'Đồng ý' | 'Từ chối' | 'Chưa hỏi';

interface ConsentRow {
  code: string;
  name: string;
  email: ConsentValue;
  sms: ConsentValue;
  zalo: ConsentValue;
  source: string;
  updatedAt: string;
  evidence: string;
}

const CONSENT_TONE: Record<ConsentValue, StatusTone> = {
  'Đồng ý': 'ok',
  'Từ chối': 'err',
  'Chưa hỏi': 'neutral',
};

const SAMPLE_CONSENTS: ConsentRow[] = [
  {
    code: 'KH-004512',
    name: 'Cửa hàng Minh Tâm',
    email: 'Đồng ý',
    sms: 'Đồng ý',
    zalo: 'Từ chối',
    source: 'Form đăng ký web',
    updatedAt: '12/05/2026',
    evidence: 'Bản ghi form',
  },
  {
    code: 'KH-003201',
    name: 'Công ty TNHH Hòa Phát Văn Phòng Phẩm',
    email: 'Đồng ý',
    sms: 'Đồng ý',
    zalo: 'Đồng ý',
    source: 'Điều khoản hợp đồng đại lý',
    updatedAt: '03/01/2026',
    evidence: 'HĐ số 12/2026',
  },
  {
    code: 'KH-006104',
    name: 'Văn phòng phẩm Hồng Hà Cầu Giấy',
    email: 'Đồng ý',
    sms: 'Từ chối',
    zalo: 'Đồng ý',
    source: 'Cuộc gọi CSKH (ghi âm)',
    updatedAt: '02/03/2026',
    evidence: 'Ghi âm 1:42',
  },
  {
    code: 'KH-013207',
    name: 'Cửa hàng An Nhiên',
    email: 'Chưa hỏi',
    sms: 'Chưa hỏi',
    zalo: 'Chưa hỏi',
    source: '—',
    updatedAt: '—',
    evidence: '—',
  },
  {
    code: 'KH-005870',
    name: 'Trường THCS Nguyễn Du',
    email: 'Đồng ý',
    sms: 'Chưa hỏi',
    zalo: 'Chưa hỏi',
    source: 'Email xác nhận của văn thư',
    updatedAt: '20/04/2026',
    evidence: 'Email lưu',
  },
  {
    code: 'KH-002018',
    name: 'Công ty CP Đầu tư Thành Công',
    email: 'Đồng ý',
    sms: 'Đồng ý',
    zalo: 'Đồng ý',
    source: 'Điều khoản hợp đồng đại lý',
    updatedAt: '15/01/2026',
    evidence: 'HĐ số 03/2026',
  },
  {
    code: 'KH-007332',
    name: 'Nhà sách Tiền Phong',
    email: 'Từ chối',
    sms: 'Từ chối',
    zalo: 'Đồng ý',
    source: 'Tin nhắn Zalo OA',
    updatedAt: '08/06/2026',
    evidence: 'Ảnh chụp tin',
  },
  {
    code: 'KH-008015',
    name: 'Cửa hàng Sao Mai',
    email: 'Chưa hỏi',
    sms: 'Đồng ý',
    zalo: 'Đồng ý',
    source: 'Cuộc gọi CSKH (ghi âm)',
    updatedAt: '11/02/2026',
    evidence: 'Ghi âm 0:58',
  },
  {
    code: 'KH-004877',
    name: 'Công ty TNHH Kế toán An Phát',
    email: 'Đồng ý',
    sms: 'Chưa hỏi',
    zalo: 'Từ chối',
    source: 'Form đăng ký web',
    updatedAt: '27/03/2026',
    evidence: 'Bản ghi form',
  },
  {
    code: 'KH-009210',
    name: 'Tiệm photocopy Quang Minh',
    email: 'Chưa hỏi',
    sms: 'Chưa hỏi',
    zalo: 'Đồng ý',
    source: 'Tin nhắn Zalo OA',
    updatedAt: '19/05/2026',
    evidence: 'Ảnh chụp tin',
  },
  {
    code: 'KH-010388',
    name: 'Văn phòng phẩm Tân Tiến',
    email: 'Từ chối',
    sms: 'Từ chối',
    zalo: 'Từ chối',
    source: 'Yêu cầu qua điện thoại (ghi âm)',
    updatedAt: '30/06/2026',
    evidence: 'Ghi âm 0:40',
  },
  {
    code: 'KH-002990',
    name: 'Công ty TNHH Dịch vụ Đức Thịnh',
    email: 'Đồng ý',
    sms: 'Đồng ý',
    zalo: 'Đồng ý',
    source: 'Form đăng ký web',
    updatedAt: '14/02/2026',
    evidence: 'Bản ghi form',
  },
  {
    code: 'KH-007801',
    name: 'Nhà sách Fahasa Long Biên',
    email: 'Đồng ý',
    sms: 'Đồng ý',
    zalo: 'Đồng ý',
    source: 'Điều khoản hợp đồng chuỗi',
    updatedAt: '09/01/2026',
    evidence: 'HĐ số 02/2026',
  },
  {
    code: 'KH-012063',
    name: 'Cửa hàng Thu Hương',
    email: 'Từ chối',
    sms: 'Chưa hỏi',
    zalo: 'Đồng ý',
    source: 'Tin nhắn Zalo OA',
    updatedAt: '21/07/2026',
    evidence: 'Ảnh chụp tin',
  },
];

function ConsentBadge({ value }: { value: ConsentValue }) {
  return <StatusBadge tone={CONSENT_TONE[value]}>{value}</StatusBadge>;
}

export function MarketingConsentScreen() {
  return (
    <>
      <PageHeader
        title="Đồng ý nhận marketing (PDPD)"
        description="1.240 KH trong team · chỉ gửi được chiến dịch tới kênh có trạng thái “Đồng ý” · bằng chứng lưu 5 năm"
        breadcrumb={[
          { label: 'Khách hàng', href: '/crm/customers' },
          { label: 'Đồng ý marketing' },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Nhập cập nhật từ CSV
            </Button>
            <Button variant="outline" size="sm">
              Xuất danh sách gửi được
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card p-1.5">
        <div className="relative w-60">
          <Search
            className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input className="h-7 pl-7 text-xs" placeholder="Tìm theo tên, SĐT, mã KH…" />
        </div>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-input bg-card px-2 text-xs"
        >
          Kênh: Tất cả <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-primary bg-secondary px-2 text-xs font-semibold text-primary"
        >
          Trạng thái: Chưa hỏi <X className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-input bg-card px-2 text-xs"
        >
          Nguồn <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-input bg-card px-2 text-xs"
        >
          Cập nhật trước <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          Đồng ý ít nhất 1 kênh: <span className="font-semibold text-foreground">918 / 1.240</span>
        </span>
      </div>

      <div className="rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="px-2.5 text-xs">Mã KH</TableHead>
                <TableHead className="px-2.5 text-xs">Khách hàng</TableHead>
                <TableHead className="px-2.5 text-xs">Email</TableHead>
                <TableHead className="px-2.5 text-xs">SMS</TableHead>
                <TableHead className="px-2.5 text-xs">Zalo</TableHead>
                <TableHead className="px-2.5 text-xs">Nguồn đồng ý</TableHead>
                <TableHead className="px-2.5 text-xs">Cập nhật</TableHead>
                <TableHead className="px-2.5 text-xs">Bằng chứng</TableHead>
                <TableHead className="w-11 px-2.5 text-xs">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_CONSENTS.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                    {c.code}
                  </TableCell>
                  <TableCell className="max-w-72 truncate px-2.5 py-1.5">{c.name}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <ConsentBadge value={c.email} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <ConsentBadge value={c.sms} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <ConsentBadge value={c.zalo} />
                  </TableCell>
                  <TableCell
                    className={
                      c.source === '—' ? 'px-2.5 py-1.5 text-muted-foreground' : 'px-2.5 py-1.5'
                    }
                  >
                    {c.source}
                  </TableCell>
                  <TableCell
                    className={
                      c.updatedAt === '—'
                        ? 'px-2.5 py-1.5 text-muted-foreground'
                        : 'px-2.5 py-1.5 tabular-nums'
                    }
                  >
                    {c.updatedAt}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    {c.evidence === '—' ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <button type="button" className="text-primary hover:underline">
                        {c.evidence}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <RowActions
                      onEdit={() =>
                        toast.info('UI-first — form sửa trạng thái đồng ý chưa nối API')
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Đang hiện 20 / 1.240 KH trong team</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="mr-2">40 dòng/trang</span>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled>
              ← Trước
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              Tiếp →
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        “Xuất danh sách gửi được” chỉ xuất KH có kênh Đồng ý — chiến dịch không bao giờ chạm tới “Từ
        chối” và “Chưa hỏi” (PDPD). Đổi trạng thái bắt buộc kèm nguồn + bằng chứng; lịch sử thay đổi
        giữ trong audit log.
      </p>
    </>
  );
}
