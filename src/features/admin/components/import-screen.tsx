'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { AlertTriangle, Check, CheckCircle2, Download, Info, Upload } from 'lucide-react';
import { useState } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

type ImportStep = 'preview' | 'result';

interface PreviewRow {
  line: number;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  team: string;
  tier: string;
  error: string | null;
  errorColumn?: 'code' | 'phone';
}

interface ErrorRow {
  line: number;
  code: string;
  name: string;
  column: string;
  value: string;
  error: string;
  fix: string;
}

interface TimelineItem {
  label: string;
  time: string;
  done?: boolean;
}

const COLUMN_MAPS: { target: string; source: string; skipped?: boolean }[] = [
  { target: 'Mã KH', source: 'ma_kh' },
  { target: 'Tên', source: 'ten_khach' },
  { target: 'SĐT', source: 'dien_thoai' },
  { target: 'Email', source: 'email' },
  { target: 'Địa chỉ', source: 'dia_chi' },
  { target: 'Team', source: 'team' },
  { target: 'Hạng', source: 'hang' },
  { target: 'Ghi chú', source: 'bỏ qua', skipped: true },
];

const SAMPLE_PREVIEW: PreviewRow[] = [
  {
    line: 1,
    code: 'KH-NEW-0001',
    name: 'Cửa hàng VPP Hoàng Long',
    phone: '0912 334 556',
    email: 'hoanglong@gmail.com',
    address: 'Số 5 Trần Phú, Hà Đông, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Bạc',
    error: null,
  },
  {
    line: 2,
    code: 'KH-NEW-0002',
    name: 'Nhà sách Tri Thức Cầu Giấy',
    phone: '0988 120 771',
    email: null,
    address: '112 Xuân Thủy, Cầu Giấy, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Đồng',
    error: null,
  },
  {
    line: 3,
    code: 'KH-NEW-0003',
    name: 'Công ty TNHH Văn phòng Việt Tiến',
    phone: '024 3856 1122',
    email: 'kt@viettien.vn',
    address: 'Tòa A, 25 Lê Văn Lương, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Vàng',
    error: null,
  },
  {
    line: 4,
    code: 'KH-NEW-0004',
    name: 'Cửa hàng Thu Hương',
    phone: '09123',
    email: null,
    address: '36 Bạch Mai, Hai Bà Trưng, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Đồng',
    error: 'SĐT sai định dạng',
    errorColumn: 'phone',
  },
  {
    line: 5,
    code: 'KH-NEW-0005',
    name: 'Nhà sách Minh Khai Q.5',
    phone: '0903 771 902',
    email: null,
    address: '148 Nguyễn Trãi, Q.5, TP.HCM',
    team: 'Sale HCM',
    tier: 'Bạc',
    error: null,
  },
  {
    line: 6,
    code: 'KH-NEW-0006',
    name: 'Công ty CP Đào tạo Sao Việt',
    phone: '028 3930 4455',
    email: 'mua@saoviet.edu.vn',
    address: '18 Cộng Hòa, Tân Bình, TP.HCM',
    team: 'Sale HCM',
    tier: 'Vàng',
    error: null,
  },
  {
    line: 7,
    code: 'KH-NEW-0007',
    name: 'Cửa hàng VPP Bình An',
    phone: '0977 601 338',
    email: null,
    address: '74 Lý Thường Kiệt, Q.10, TP.HCM',
    team: 'Sale HCM',
    tier: 'Đồng',
    error: null,
  },
  {
    line: 8,
    code: 'KH-NEW-0008',
    name: 'Trường Tiểu học Kim Đồng',
    phone: '024 3771 9021',
    email: null,
    address: 'Ngõ 12 Kim Đồng, Hoàng Mai, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Bạc',
    error: null,
  },
  {
    line: 9,
    code: 'KH-004512',
    name: 'Cửa hàng Minh Tâm',
    phone: '0912 345 678',
    email: null,
    address: 'Số 12 Lê Lợi, Hoàn Kiếm, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Bạc',
    error: 'Mã KH trùng (đã tồn tại)',
    errorColumn: 'code',
  },
  {
    line: 10,
    code: 'KH-NEW-0010',
    name: 'Nhà sách Hồng Ân Thủ Đức',
    phone: '0908 223 119',
    email: null,
    address: '40 Võ Văn Ngân, Thủ Đức, TP.HCM',
    team: 'Sale HCM',
    tier: 'Đồng',
    error: null,
  },
  {
    line: 11,
    code: 'KH-NEW-0011',
    name: 'Công ty TNHH Kiến An Office',
    phone: '0243 555 8890',
    email: 'sales@kienan.vn',
    address: '9 Duy Tân, Cầu Giấy, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Vàng',
    error: null,
  },
  {
    line: 12,
    code: 'KH-NEW-0012',
    name: 'Cửa hàng Phúc Lộc Gò Vấp',
    phone: '0933 480 211',
    email: null,
    address: '210 Quang Trung, Gò Vấp, TP.HCM',
    team: 'Sale HCM',
    tier: 'Đồng',
    error: null,
  },
  {
    line: 13,
    code: 'KH-NEW-0013',
    name: 'Nhà sách Ngọc Hà',
    phone: '0969 115 772',
    email: null,
    address: '31 Ngọc Hà, Ba Đình, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Đồng',
    error: null,
  },
  {
    line: 14,
    code: 'KH-NEW-0014',
    name: 'Công ty CP Thiết bị Giáo dục Miền Nam',
    phone: '028 6271 0033',
    email: 'info@tbgdmn.com',
    address: '55 Nguyễn Văn Trỗi, Phú Nhuận, TP.HCM',
    team: 'Sale HCM',
    tier: 'Vàng',
    error: null,
  },
  {
    line: 15,
    code: 'KH-NEW-0015',
    name: 'Cửa hàng VPP An Khang',
    phone: '0918 776 540',
    email: null,
    address: '12 Tôn Đức Thắng, Đống Đa, Hà Nội',
    team: 'Sale Hà Nội',
    tier: 'Bạc',
    error: null,
  },
];

const SAMPLE_ERRORS: ErrorRow[] = [
  {
    line: 4,
    code: 'KH-NEW-0004',
    name: 'Cửa hàng Thu Hương',
    column: 'dien_thoai',
    value: '09123',
    error: 'SĐT sai định dạng',
    fix: 'Nhập đủ 10 số, ví dụ 0912 300 123',
  },
  {
    line: 9,
    code: 'KH-004512',
    name: 'Cửa hàng Minh Tâm',
    column: 'ma_kh',
    value: 'KH-004512',
    error: 'Mã KH trùng (đã tồn tại)',
    fix: 'Bỏ dòng này, hoặc chạy lại với chế độ "cập nhật nếu trùng"',
  },
];

const SAMPLE_TIMELINE: TimelineItem[] = [
  { label: 'Hoàn tất · 118 tạo, 2 bỏ qua', time: '10:21:14', done: true },
  { label: 'Ghi lô 3/3 (dòng 81–120)', time: '10:21:12' },
  { label: 'Ghi lô 2/3 (dòng 41–80)', time: '10:21:08' },
  { label: 'Ghi lô 1/3 (dòng 1–40) · bỏ qua dòng 4, 9', time: '10:21:04' },
  { label: 'Validate lại toàn bộ 120 dòng', time: '10:21:00' },
  { label: 'Bắt đầu chạy thật · Lê Quang Huy xác nhận', time: '10:21:00 · traceId 9c21-4ab0' },
];

function Stepper({ step }: { step: ImportStep }) {
  const items =
    step === 'preview'
      ? [
          { label: 'Tải file', state: 'done' },
          { label: 'Map cột', state: 'done' },
          { label: 'Xem trước', state: 'on', n: 3 },
          { label: 'Chạy', state: 'todo', n: 4 },
          { label: 'Kết quả', state: 'todo', n: 5 },
        ]
      : [
          { label: 'Tải file', state: 'done' },
          { label: 'Map cột', state: 'done' },
          { label: 'Xem trước', state: 'done' },
          { label: 'Chạy', state: 'done' },
          { label: 'Kết quả', state: 'on', n: 5 },
        ];
  return (
    <ol className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      {items.map((it, i) => (
        <li key={it.label} className="flex items-center gap-2">
          {i > 0 ? <span className="h-px w-6 bg-border" aria-hidden /> : null}
          <span
            className={cn(
              'flex items-center gap-1.5',
              it.state === 'on' && 'font-semibold text-primary',
              it.state === 'todo' && 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                it.state === 'done' && 'bg-success/10 text-success',
                it.state === 'on' && 'bg-primary text-primary-foreground',
                it.state === 'todo' && 'bg-muted text-muted-foreground',
              )}
            >
              {it.state === 'done' ? <Check className="h-3 w-3" aria-hidden /> : it.n}
            </span>
            {it.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PreviewStep({ onRun }: { onRun: () => void }) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">Map cột:</span>
        {COLUMN_MAPS.map((m) => (
          <span
            key={m.target}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs',
              m.skipped && 'text-muted-foreground',
            )}
          >
            {m.target} ←{' '}
            {m.skipped ? <i>{m.source}</i> : <span className="font-semibold">{m.source}</span>}
          </span>
        ))}
        <button type="button" className="ml-auto text-sm text-primary hover:underline">
          Sửa map cột
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">
            Xem trước · <span className="text-success">118 hợp lệ</span> ·{' '}
            <span className="text-destructive">2 lỗi</span>
          </h2>
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox aria-label="Chỉ hiện dòng lỗi" />
            Chỉ hiện dòng lỗi
          </label>
        </div>
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="px-2.5 text-right">Dòng</TableHead>
              <TableHead className="px-2.5">Mã KH</TableHead>
              <TableHead className="px-2.5">Tên</TableHead>
              <TableHead className="px-2.5">SĐT</TableHead>
              <TableHead className="px-2.5">Email</TableHead>
              <TableHead className="px-2.5">Địa chỉ</TableHead>
              <TableHead className="px-2.5">Team</TableHead>
              <TableHead className="px-2.5">Hạng</TableHead>
              <TableHead className="px-2.5">Kiểm tra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_PREVIEW.map((r) => (
              <TableRow key={r.line} className={cn(r.error && 'bg-destructive/10')}>
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                  {r.line}
                </TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5 font-mono text-xs',
                    r.errorColumn === 'code' && 'font-semibold text-destructive',
                  )}
                >
                  {r.code}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">{r.name}</TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5 font-mono text-xs',
                    r.errorColumn === 'phone' && 'font-semibold text-destructive',
                  )}
                >
                  {r.phone}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                  {r.email ?? '—'}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">{r.address}</TableCell>
                <TableCell className="px-2.5 py-1.5">{r.team}</TableCell>
                <TableCell className="px-2.5 py-1.5">{r.tier}</TableCell>
                <TableCell className="px-2.5 py-1.5">
                  {r.error ? (
                    <span className="text-destructive">{r.error}</span>
                  ) : (
                    <StatusBadge tone="ok">Hợp lệ</StatusBadge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-2.5 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–20 / 120</span>
          <span className="flex items-center gap-1">
            <span className="px-1.5">‹</span>
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-semibold text-primary">
              1
            </span>
            <span className="px-1.5">2</span>
            <span className="px-1.5">3</span>
            <span className="px-1.5">…</span>
            <span className="px-1.5">6</span>
            <span className="px-1.5">›</span>
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2.5">
        <div className="flex min-w-64 flex-1 items-start gap-2 rounded-md border bg-warning/10 px-3 py-1.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">2 dòng lỗi sẽ bị bỏ qua</span> khi chạy thật; 118 dòng
            còn lại được tạo. Sửa file và tải lại nếu muốn đủ 120.
          </p>
        </div>
        <Button variant="outline">← Map cột</Button>
        <Button variant="outline">Chạy thử (dry run)</Button>
        <Button onClick={onRun}>Chạy thật · tạo 118 khách</Button>
      </div>
    </>
  );
}

function ResultStep() {
  return (
    <>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng dòng" value="120" detail="Đọc từ file" />
        <KpiCard
          label="Đã tạo"
          value={<span className="text-success">118</span>}
          detail="KH-004901 → KH-005018"
        />
        <KpiCard
          label="Bỏ qua do lỗi"
          value={<span className="text-destructive">2</span>}
          detail="Dòng 4, 9"
        />
        <KpiCard label="Cập nhật" value="0" detail={'Chế độ "chỉ tạo mới"'} />
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_400px]">
        <div className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Dòng lỗi · 2</h2>
            <Button variant="outline" size="sm">
              <Download aria-hidden />
              Tải CSV lỗi (2 dòng)
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-2.5 text-right">Dòng</TableHead>
                  <TableHead className="px-2.5">Mã KH</TableHead>
                  <TableHead className="px-2.5">Tên</TableHead>
                  <TableHead className="px-2.5">Cột lỗi</TableHead>
                  <TableHead className="px-2.5">Giá trị</TableHead>
                  <TableHead className="px-2.5">Lỗi</TableHead>
                  <TableHead className="px-2.5">Cách sửa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_ERRORS.map((r) => (
                  <TableRow key={r.line} className="bg-destructive/10">
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.line}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="px-2.5 py-1.5">{r.name}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.column}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-destructive">
                      {r.value}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{r.error}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">{r.fix}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col items-center gap-2 border-t px-3 py-8 text-center">
            <p className="font-semibold">Sửa 2 dòng trong file CSV lỗi rồi tải lại</p>
            <p className="text-sm text-muted-foreground">
              File lỗi giữ nguyên cột gốc + thêm cột &quot;loi&quot; và &quot;cach_sua&quot;. Các
              dòng đã tạo không bị tạo lại.
            </p>
            <Button className="mt-1">
              <Upload aria-hidden />
              Tải lại file đã sửa
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <section className="rounded-md border bg-card">
            <h2 className="border-b px-3 py-2 text-sm font-semibold">Bản ghi đã tạo</h2>
            <div className="space-y-2 px-3 py-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span>Khách hàng</span>
                <button type="button" className="text-primary hover:underline">
                  118 khách · lọc &quot;import #IMP-2608-011&quot;
                </button>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span>Phân team</span>
                <span className="text-muted-foreground">Sale Hà Nội 71 · Sale HCM 47</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span>Người phụ trách</span>
                <span className="text-muted-foreground">Chưa phân · leader phân sau</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mỗi khách tạo ra mang tag <span className="font-mono">import:IMP-2608-011</span> để
                tìm lại và hoàn tác theo lô.
              </p>
            </div>
          </section>
          <section className="rounded-md border bg-card">
            <h2 className="border-b px-3 py-2 text-sm font-semibold">Nhật ký chạy</h2>
            <ol className="px-3 py-2">
              {SAMPLE_TIMELINE.map((t) => (
                <li key={t.label} className="flex gap-2.5 border-b py-2 text-sm last:border-b-0">
                  {t.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border" aria-hidden />
                  )}
                  <span>
                    {t.label}
                    <span className="block text-xs text-muted-foreground">{t.time}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <div className="flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Hoàn tác theo lô chỉ xóa được khách chưa có đơn/ticket. Hiện 118/118 chưa có phát sinh
              →{' '}
              <button type="button" className="text-primary hover:underline">
                Hoàn tác lô này
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function ImportScreen() {
  const [step, setStep] = useState<ImportStep>('preview');
  return (
    <>
      {step === 'preview' ? (
        <PageHeader
          title="Import khách hàng"
          description="khach-hang-thang-8.xlsx · 120 dòng · tải lên 10:02 bởi Lê Quang Huy"
          breadcrumb={[
            { label: 'Quản trị' },
            { label: 'Hệ thống' },
            { label: 'Import / Export' },
            { label: 'Khách hàng' },
          ]}
          actions={<Button variant="ghost">Hủy import</Button>}
        />
      ) : (
        <PageHeader
          title="Import khách hàng"
          description="khach-hang-thang-8.xlsx · chạy lúc 10:21 · 14 giây · Lê Quang Huy"
          breadcrumb={[
            { label: 'Quản trị' },
            { label: 'Hệ thống' },
            { label: 'Import / Export' },
            { label: 'Khách hàng' },
          ]}
          actions={
            <>
              <StatusBadge tone="ok">Hoàn tất</StatusBadge>
              <Button variant="outline" onClick={() => setStep('preview')}>
                Import file khác
              </Button>
              <Button>Mở 118 khách vừa tạo</Button>
            </>
          }
        />
      )}
      <Stepper step={step} />
      {step === 'preview' ? <PreviewStep onRun={() => setStep('result')} /> : <ResultStep />}
    </>
  );
}
