'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

interface RuleItem {
  order: number;
  name: string;
  summary: string;
  status: 'on' | 'off' | 'pending';
  active?: boolean;
}

const RULE_STATUS: Record<RuleItem['status'], { label: string; tone: StatusTone }> = {
  on: { label: 'Đang bật', tone: 'ok' },
  off: { label: 'Tạm tắt', tone: 'neutral' },
  pending: { label: 'Chờ kế toán xác nhận', tone: 'warn' },
};

const SAMPLE_RULES: RuleItem[] = [
  {
    order: 1,
    name: 'Chiết khấu vượt trần bảng giá',
    summary: 'CK% > trần bảng giá · Duyệt: leader của sale',
    status: 'on',
    active: true,
  },
  {
    order: 2,
    name: 'Đơn giá trị lớn',
    summary: 'Tổng ≥ 10.000.000 · Duyệt: leader → trưởng phòng KD',
    status: 'on',
  },
  {
    order: 3,
    name: 'Vượt hạn mức công nợ',
    summary: 'Công nợ sau đơn > hạn mức · Duyệt: kế toán trưởng',
    status: 'off',
  },
  {
    order: 4,
    name: 'Khách mới chưa xác minh',
    summary: 'KH tạo < 7 ngày · Duyệt: leader của sale',
    status: 'on',
  },
  {
    order: 5,
    name: 'Giá bán thấp hơn giá vốn',
    summary: 'Đơn giá < COGS hiện tại · Duyệt: trưởng phòng KD',
    status: 'pending',
  },
  {
    order: 6,
    name: 'Điều chỉnh tồn > 50 đơn vị',
    summary: 'Phiếu điều chỉnh SL > 50 · Duyệt: quản lý kho',
    status: 'on',
  },
];

function SelectField({ value, unit }: { value: string; unit?: string }) {
  return (
    <div className="flex h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-md border border-input bg-background px-2.5 text-sm">
      <span className="truncate">{value}</span>
      {unit ? (
        <span className="text-muted-foreground">{unit}</span>
      ) : (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

export function ApprovalRulesScreen() {
  return (
    <>
      <PageHeader
        title="Quy tắc duyệt"
        description="6 quy tắc · áp theo thứ tự từ trên xuống, đơn khớp nhiều quy tắc thì gộp người duyệt"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Hệ thống' }, { label: 'Quy tắc duyệt' }]}
        actions={
          <>
            <Button variant="outline">Thử với đơn mẫu</Button>
            <Button>Thêm quy tắc</Button>
          </>
        }
      />
      <div className="grid items-start gap-3 xl:grid-cols-[420px_1fr]">
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Danh sách</h2>
            <span className="text-xs text-muted-foreground">kéo để đổi thứ tự</span>
          </div>
          <div>
            {SAMPLE_RULES.map((r) => {
              const s = RULE_STATUS[r.status];
              return (
                <button
                  key={r.order}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted',
                    r.active && 'bg-secondary/50',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                    {r.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.summary}
                    </span>
                  </span>
                  <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Quy tắc 1 · Chiết khấu vượt trần bảng giá</h2>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                role="switch"
                aria-checked="true"
                aria-label="Đang bật"
                className="inline-flex h-4 w-7 items-center justify-end rounded-full bg-primary px-0.5"
              >
                <span className="h-3 w-3 rounded-full bg-background" />
              </span>
              Đang bật
            </span>
          </div>
          <div className="space-y-4 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Tên quy tắc</span>
                <Input defaultValue="Chiết khấu vượt trần bảng giá" className="h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Áp cho</span>
                <SelectField value="Đơn bán hàng" />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Mã</span>
                <Input defaultValue="RULE-DISC-CAP" className="h-8 bg-muted font-mono" readOnly />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Điều kiện{' '}
                <span className="font-normal text-muted-foreground">
                  · khớp khi <u>bất kỳ</u> điều kiện đúng
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <SelectField value="Dòng hàng" />
                <SelectField value="Chiết khấu %" />
                <SelectField value="lớn hơn" />
                <SelectField value="trần của bảng giá" />
                <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <div className="flex items-center gap-2">
                <SelectField value="Đơn hàng" />
                <SelectField value="Tổng chiết khấu %" />
                <SelectField value="lớn hơn" />
                <SelectField value="15" unit="%" />
                <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <Button variant="outline" size="sm">
                + Điều kiện
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Người duyệt{' '}
                <span className="font-normal text-muted-foreground">
                  · theo thứ tự, bước sau chỉ chạy khi bước trước duyệt
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  1
                </span>
                <SelectField value="Leader của sale tạo đơn" />
                <SelectField value="Bất kỳ 1 leader trong team" />
                <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  2
                </span>
                <SelectField value="Vai trò: Trưởng phòng kinh doanh" />
                <SelectField value="Chỉ khi CK > 25%" />
                <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <Button variant="outline" size="sm">
                + Bước duyệt
              </Button>
              <div className="flex items-start gap-2 rounded-md border bg-warning/10 px-3 py-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  <span className="font-semibold">Sale Hà Nội hiện có 1 leader.</span> Nếu leader
                  nghỉ, đơn sẽ chờ vô hạn — bật &quot;Leo thang sau 4 giờ lên trưởng phòng&quot; bên
                  dưới.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Leo thang sau</span>
                <SelectField value="4 giờ" />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Leo thang tới</span>
                <SelectField value="Trưởng phòng kinh doanh" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Thông báo</span>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <Checkbox checked aria-label="In-app" />
                    In-app
                  </label>
                  <label className="flex items-center gap-1.5">
                    <Checkbox checked aria-label="Email" />
                    Email
                  </label>
                  <label className="flex items-center gap-1.5">
                    <Checkbox aria-label="Zalo" />
                    Zalo
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t pt-3">
              <span className="mr-auto text-xs text-muted-foreground">
                Đổi lần cuối 11/08/2026 · Lê Quang Huy
              </span>
              <Button variant="ghost">Hủy bỏ</Button>
              <Button>Lưu thay đổi</Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
