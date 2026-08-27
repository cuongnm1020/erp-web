'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { CheckCircle2, Eye, Info } from 'lucide-react';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

interface PasswordRule {
  label: string;
  met: boolean;
}

interface ChannelPrefRow {
  event: string;
  email: boolean;
  sms: boolean;
  zalo: boolean;
  inApp: boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Ít nhất 10 ký tự', met: true },
  { label: 'Có chữ hoa và chữ thường', met: true },
  { label: 'Có ít nhất một chữ số', met: true },
  { label: 'Không trùng 5 mật khẩu gần nhất', met: false },
];

const SAMPLE_CHANNEL_PREFS: ChannelPrefRow[] = [
  { event: 'Đơn chờ tôi duyệt', email: true, sms: true, zalo: false, inApp: true },
  { event: 'Đơn của tôi được duyệt / từ chối', email: true, sms: false, zalo: true, inApp: true },
  { event: 'Task kho quá hạn SLA', email: true, sms: false, zalo: false, inApp: true },
  { event: 'Ngoại lệ kho mới', email: true, sms: false, zalo: false, inApp: true },
  { event: 'Chứng từ đã post', email: false, sms: false, zalo: false, inApp: true },
  { event: 'Công nợ vượt hạn mức', email: true, sms: false, zalo: false, inApp: true },
  { event: 'Công nợ quá hạn 30 ngày', email: true, sms: true, zalo: false, inApp: true },
  { event: 'Webhook thất bại', email: true, sms: false, zalo: false, inApp: true },
  { event: 'Khóa kỳ kế toán', email: true, sms: false, zalo: false, inApp: true },
  { event: 'Khách chuyển team', email: true, sms: false, zalo: false, inApp: true },
  { event: 'Import hoàn tất', email: true, sms: false, zalo: false, inApp: true },
  { event: 'PDA offline > 24h', email: false, sms: false, zalo: false, inApp: true },
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

export function MeScreen() {
  return (
    <>
      <PageHeader
        title="Tài khoản của tôi"
        description="Tài khoản: huy.lq@congty.vn · Đổi lần cuối 14/05/2026"
        breadcrumb={[{ label: 'Tài khoản của tôi' }]}
      />
      <div className="grid items-start gap-3 xl:grid-cols-[480px_320px_1fr]">
        <section className="rounded-md border bg-card">
          <h2 className="border-b px-3 py-2 text-sm font-semibold">Đổi mật khẩu</h2>
          <div className="space-y-4 p-3">
            <div className="space-y-1">
              <Label htmlFor="current-password" className="text-xs text-muted-foreground">
                Mật khẩu hiện tại <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input id="current-password" type="password" className="h-8 pr-8" />
                <Eye
                  className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-password" className="text-xs text-muted-foreground">
                Mật khẩu mới <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input id="new-password" type="password" className="h-8 pr-8" />
                <Eye
                  className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">
                Nhập lại mật khẩu mới <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                className="h-8"
                placeholder="Nhập lại để xác nhận"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked aria-label="Đăng xuất khỏi các thiết bị khác" />
              Đăng xuất khỏi các thiết bị khác (2 phiên đang mở)
            </label>
            <div className="flex items-center gap-2">
              <Button>Lưu thay đổi</Button>
              <Button variant="ghost">Hủy bỏ</Button>
            </div>
          </div>
        </section>

        <section className="rounded-md border bg-card">
          <h2 className="border-b px-3 py-2 text-sm font-semibold">Yêu cầu mật khẩu</h2>
          <div className="space-y-2 p-3 text-sm">
            {PASSWORD_RULES.map((r) => (
              <p
                key={r.label}
                className={cn(
                  'flex items-center gap-1.5',
                  r.met ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {r.met ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <Info className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {r.label}
              </p>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Sau khi đổi, phiên hiện tại vẫn giữ nguyên; PDA đã liên kết phải đăng nhập lại.
            </p>
          </div>
        </section>

        <section className="rounded-md border bg-card">
          <div className="flex items-baseline justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Cấu hình kênh nhận</h2>
            <span className="text-xs text-muted-foreground">của tôi</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-2.5">Sự kiện</TableHead>
                  <TableHead className="px-2.5">Email</TableHead>
                  <TableHead className="px-2.5">SMS</TableHead>
                  <TableHead className="px-2.5">Zalo</TableHead>
                  <TableHead className="px-2.5">In-app</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_CHANNEL_PREFS.map((p) => (
                  <TableRow key={p.event}>
                    <TableCell className="px-2.5 py-1.5">{p.event}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Toggle on={p.email} label={`Email · ${p.event}`} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Toggle on={p.sms} label={`SMS · ${p.event}`} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Toggle on={p.zalo} label={`Zalo · ${p.event}`} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <Toggle on={p.inApp} label={`In-app · ${p.event}`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 border-t p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">Email</span>
              <span className="font-mono text-xs">binh.tt@congty.vn</span>
              <StatusBadge tone="ok">Đã xác minh</StatusBadge>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">SMS</span>
              <span className="font-mono text-xs">0903 118 224</span>
              <StatusBadge tone="ok">Đã xác minh</StatusBadge>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">Zalo</span>
              <span className="text-muted-foreground">Chưa liên kết</span>
              <button type="button" className="text-primary hover:underline">
                Liên kết Zalo OA
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              In-app không tắt được cho sự kiện &quot;Đơn chờ tôi duyệt&quot; và &quot;Task quá
              hạn&quot; — đó là việc của bạn.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost">Hoàn tác</Button>
              <Button>Lưu thay đổi</Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
