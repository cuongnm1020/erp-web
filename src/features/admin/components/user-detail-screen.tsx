'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Users, Warehouse } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatDateTime } from '@/lib/format';

interface TeamMembership {
  team: string;
  role: 'member' | 'leader';
  since: string;
}

interface PdaLink {
  deviceCode: string;
  warehouse: string;
  lastOnlineAt: string;
}

interface LoginRow {
  at: string;
  device: string;
  ip: string;
  result: 'ok' | 'wrong-password';
}

const SAMPLE_TEAMS: TeamMembership[] = [
  { team: 'Sale Hà Nội', role: 'member', since: '2024-03-04T00:00:00+07:00' },
  { team: 'Dự án trường học 2026', role: 'leader', since: '2026-06-01T00:00:00+07:00' },
];

const SAMPLE_PDA: PdaLink[] = [
  { deviceCode: 'PDA-HN-07', warehouse: 'Kho HN-1', lastOnlineAt: '2026-08-21T16:02:00+07:00' },
];

const SAMPLE_LOGINS: LoginRow[] = [
  {
    at: '2026-08-23T09:41:00+07:00',
    device: 'Web · Chrome 128 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
  {
    at: '2026-08-22T17:42:00+07:00',
    device: 'Web · Chrome 128 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
  {
    at: '2026-08-22T08:02:00+07:00',
    device: 'Web · Chrome 128 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
  {
    at: '2026-08-21T13:15:00+07:00',
    device: 'Web · Safari / iPhone',
    ip: '113.161.72.8',
    result: 'ok',
  },
  {
    at: '2026-08-21T13:14:00+07:00',
    device: 'Web · Safari / iPhone',
    ip: '113.161.72.8',
    result: 'wrong-password',
  },
  {
    at: '2026-08-21T07:58:00+07:00',
    device: 'Web · Chrome 128 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
  {
    at: '2026-08-20T08:10:00+07:00',
    device: 'Web · Chrome 128 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
  {
    at: '2026-08-19T08:04:00+07:00',
    device: 'Web · Chrome 128 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
  {
    at: '2026-08-18T07:59:00+07:00',
    device: 'Web · Chrome 128 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
  {
    at: '2026-08-17T08:12:00+07:00',
    device: 'Web · Chrome 127 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
  {
    at: '2026-08-16T09:30:00+07:00',
    device: 'Web · Safari / iPhone',
    ip: '14.177.3.201',
    result: 'ok',
  },
  {
    at: '2026-08-15T08:01:00+07:00',
    device: 'Web · Chrome 127 / Windows',
    ip: '10.0.12.45',
    result: 'ok',
  },
];

const TEAM_ROLE: Record<TeamMembership['role'], { label: string; tone: StatusTone }> = {
  member: { label: 'Thành viên', tone: 'neutral' },
  leader: { label: 'Leader', tone: 'brand' },
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <dt className="w-32 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function UserDetailScreen({ id }: { id: string }) {
  return (
    <>
      <PageHeader
        title="Nguyễn Văn An"
        description={`${id} · an.nv@congty.vn · Tạo 04/03/2024 bởi Lê Quang Huy`}
        breadcrumb={[
          { label: 'Quản trị' },
          { label: 'Nhân viên', href: '/admin/users' },
          { label: id },
        ]}
        actions={
          <>
            <Button variant="outline">Đặt lại mật khẩu</Button>
            <Button variant="outline">Khóa tài khoản</Button>
            <Button>Sửa thông tin</Button>
          </>
        }
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-md border bg-card">
          <h2 className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            Thông tin
            <StatusBadge tone="ok">Hoạt động</StatusBadge>
          </h2>
          <dl className="px-3 py-2">
            <InfoRow label="Họ tên" value={<span className="font-semibold">Nguyễn Văn An</span>} />
            <InfoRow label="Điện thoại" value="0912 445 118" />
            <InfoRow label="Phòng ban" value="Kinh doanh" />
            <InfoRow label="Chức danh" value="Nhân viên kinh doanh" />
            <InfoRow label="Ngày vào" value="04/03/2024" />
            <InfoRow label="Ngôn ngữ" value="Tiếng Việt" />
            <InfoRow
              label="Xác thực 2 lớp"
              value={<StatusBadge tone="warn">Chưa bật</StatusBadge>}
            />
          </dl>
        </section>
        <section className="rounded-md border bg-card">
          <h2 className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            Vai trò
            <button type="button" className="text-sm font-normal text-primary hover:underline">
              Sửa
            </button>
          </h2>
          <div className="space-y-2.5 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Sale</span>
              <span className="text-xs text-muted-foreground">24 quyền</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tạo/sửa đơn của khách được phân · xem tồn khả dụng · xem công nợ KH của mình · tạo
              ticket
            </p>
            <div className="space-y-2 border-t pt-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground">Phạm vi dữ liệu</h3>
              <p className="flex items-center gap-1.5 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span>
                  Khách hàng: <span className="font-semibold">38</span> khách được phân bởi Trần Thị
                  Bình
                </span>
              </p>
              <p className="flex items-center gap-1.5 text-sm">
                <Warehouse className="h-4 w-4 text-muted-foreground" aria-hidden />
                Kho: xem tồn Kho HN-1
              </p>
            </div>
          </div>
        </section>
        <section className="rounded-md border bg-card">
          <h2 className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            Team
            <button type="button" className="text-sm font-normal text-primary hover:underline">
              Thêm vào team
            </button>
          </h2>
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="px-2.5">Team</TableHead>
                <TableHead className="px-2.5">Vai trò trong team</TableHead>
                <TableHead className="px-2.5 text-right">Từ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_TEAMS.map((t) => {
                const r = TEAM_ROLE[t.role];
                return (
                  <TableRow key={t.team}>
                    <TableCell className="px-2.5 py-1.5 text-primary">{t.team}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={r.tone}>{r.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatDate(t.since)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Là leader của &quot;Dự án trường học 2026&quot; → thấy toàn bộ khách của team đó.
          </p>
        </section>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-md border bg-card">
          <h2 className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            Thiết bị PDA liên kết
            <button type="button" className="text-sm font-normal text-primary hover:underline">
              Gán thiết bị
            </button>
          </h2>
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="px-2.5">Mã thiết bị</TableHead>
                <TableHead className="px-2.5">Kho</TableHead>
                <TableHead className="px-2.5 text-right">Online cuối</TableHead>
                <TableHead className="px-2.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_PDA.map((d) => (
                <TableRow key={d.deviceCode}>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{d.deviceCode}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{d.warehouse}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatDateTime(d.lastOnlineAt)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <button type="button" className="text-primary hover:underline">
                      Gỡ
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t px-3 py-4 text-xs text-muted-foreground">
            Tài khoản sale thường không cần PDA. Thiết bị này được gán tạm cho đợt kiểm kê 21/08.
          </p>
        </section>
        <section className="rounded-md border bg-card">
          <h2 className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            <span>
              Lịch sử đăng nhập <span className="font-normal text-muted-foreground">· 30 ngày</span>
            </span>
            <button type="button" className="text-sm font-normal text-primary hover:underline">
              Xem audit log
            </button>
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-2.5 text-right">Thời gian</TableHead>
                  <TableHead className="px-2.5">Thiết bị</TableHead>
                  <TableHead className="px-2.5">IP</TableHead>
                  <TableHead className="px-2.5">Kết quả</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_LOGINS.map((l) => (
                  <TableRow key={l.at}>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatDateTime(l.at)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{l.device}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.ip}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {l.result === 'ok' ? (
                        <StatusBadge tone="ok">Thành công</StatusBadge>
                      ) : (
                        <StatusBadge tone="err">Sai mật khẩu</StatusBadge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </>
  );
}
