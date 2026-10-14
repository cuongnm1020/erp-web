'use client';

import { Pencil, Plus, Power, RefreshCw, Star, Trash2, Truck } from 'lucide-react';
import { Fragment, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
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
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format/date';
import { Can } from '@/lib/permission';
import {
  useCarrierSettings,
  useDeleteCarrierAccount,
  useSetDefaultCarrierAccount,
  useUpdateCarrierAccount,
  useVerifyCarrierAccount,
  type CarrierAccount,
  type CarrierSetting,
  type CarrierSettingField,
} from '../api/use-carrier-settings';
import { CarrierSettingDialog } from './carrier-setting-dialog';

const SOURCE_LABEL: Record<NonNullable<CarrierSettingField['source']>, string> = {
  db: 'nhập ở đây',
  env: 'từ env',
  apiConfig: 'cấu hình cũ',
};

/**
 * Cấu hình hệ thống › Đơn vị vận chuyển (FE-CARRIER-ACC-1) — GET /carriers/settings, thêm / sửa /
 * đặt mặc định / bật tắt / xóa / kiểm tra từng tài khoản (/carriers/{code}/accounts…).
 * Mỗi hãng một khối, mỗi tài khoản một dòng: trường đang hiệu lực + nguồn (nhập ở đây / env), kết
 * quả kiểm tra kết nối gần nhất. Lưu xong tự kiểm tra kết nối tài khoản vừa lưu.
 */
export function CarrierSettingsSection() {
  const query = useCarrierSettings();
  const verify = useVerifyCarrierAccount();
  const [editing, setEditing] = useState<{
    setting: CarrierSetting;
    account: CarrierAccount | null;
  } | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const runVerify = (setting: CarrierSetting, accountId: string) => {
    const account = setting.accounts.find((a) => a.id === accountId);
    const label = `${setting.name}${account && !account.isDefault ? ` (${account.name})` : ''}`;
    setVerifying(accountId);
    verify.mutate(
      { code: setting.code, accountId },
      {
        onSuccess: (r) => {
          if (r.status === 'ok')
            toast.success(`Kết nối ${label} thành công`, { description: r.message });
          else if (r.status === 'failed')
            toast.error(`Kết nối ${label} thất bại`, { description: r.message });
          else toast.info(r.message);
        },
        onError: (err) => toast.error(messageFor(err)),
        onSettled: () => setVerifying(null),
      },
    );
  };

  return (
    <section className="rounded-md border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Đơn vị vận chuyển</h2>
        <span className="text-xs text-muted-foreground">
          Mỗi hãng nhiều tài khoản, sale chọn khi gửi đơn · giá trị nhập ở đây thắng biến môi trường
          · token chỉ hiện 4 ký tự cuối
        </span>
      </div>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={4} columns={5} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={Truck}
            title="Chưa có hãng vận chuyển nào kết nối API"
            description="Hãng có tích hợp (GHN, GHTK, Viettel Post…) sẽ hiện ở đây khi được bật trong danh mục hãng."
          />
        }
      >
        {(items) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-2.5">Tài khoản</TableHead>
                  <TableHead className="px-2.5">Thông tin kết nối</TableHead>
                  <TableHead className="px-2.5">Kiểm tra kết nối</TableHead>
                  <TableHead className="px-2.5">Cập nhật</TableHead>
                  <TableHead className="w-px px-2.5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <Fragment key={c.code}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={5} className="px-2.5 py-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{c.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                          {c.isActive ? null : (
                            <StatusBadge tone="neutral">Hãng đang tắt</StatusBadge>
                          )}
                          <Can I="config" a="Carrier">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto h-7"
                              onClick={() => setEditing({ setting: c, account: null })}
                              aria-label={`Thêm tài khoản ${c.name}`}
                            >
                              <Plus aria-hidden />
                              Thêm tài khoản
                            </Button>
                          </Can>
                        </div>
                      </TableCell>
                    </TableRow>
                    {c.accounts.map((a) => (
                      <AccountRow
                        key={a.id}
                        setting={c}
                        account={a}
                        verifying={verifying}
                        onVerify={() => runVerify(c, a.id)}
                        onEdit={() => setEditing({ setting: c, account: a })}
                      />
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      {editing ? (
        <CarrierSettingDialog
          setting={editing.setting}
          account={editing.account}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={(accountId) => {
            if (editing.setting.canVerify && accountId) runVerify(editing.setting, accountId);
          }}
        />
      ) : null}
    </section>
  );
}

function AccountRow({
  setting: c,
  account: a,
  verifying,
  onVerify,
  onEdit,
}: {
  setting: CarrierSetting;
  account: CarrierAccount;
  verifying: string | null;
  onVerify: () => void;
  onEdit: () => void;
}) {
  const setDefault = useSetDefaultCarrierAccount();
  const update = useUpdateCarrierAccount();
  const remove = useDeleteCarrierAccount();
  const [deleting, setDeleting] = useState(false);
  const label = `${a.name} của ${c.name}`;
  const busy = setDefault.isPending || update.isPending;

  const toggleActive = () =>
    update.mutate(
      { code: c.code, accountId: a.id, input: { isActive: !a.isActive } },
      {
        onSuccess: () => toast.success(a.isActive ? 'Đã tắt tài khoản' : 'Đã bật tài khoản'),
        onError: (err) => toast.error(messageFor(err)),
      },
    );

  return (
    <TableRow className="align-top">
      <TableCell className="px-2.5 py-2">
        <div className="font-medium">{a.name}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {a.isDefault ? <StatusBadge tone="brand">Mặc định</StatusBadge> : null}
          {a.configured ? (
            <StatusBadge tone="ok">Đủ cấu hình</StatusBadge>
          ) : (
            <StatusBadge tone="warn">Thiếu cấu hình</StatusBadge>
          )}
          {a.isActive ? null : <StatusBadge tone="neutral">Đang tắt</StatusBadge>}
          {a.secretsUnreadable ? <StatusBadge tone="err">Token không đọc được</StatusBadge> : null}
        </div>
      </TableCell>
      <TableCell className="px-2.5 py-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {a.fields.map((f) => (
            <FieldRow key={f.key} field={f} />
          ))}
        </dl>
      </TableCell>
      <TableCell className="max-w-xs px-2.5 py-2 text-sm">
        {a.lastVerifyError ? (
          <span className="text-destructive">{a.lastVerifyError}</span>
        ) : a.lastVerifiedAt ? (
          <span>
            <StatusBadge tone="ok">OK</StatusBadge>{' '}
            <span className="text-muted-foreground">{formatDateTime(a.lastVerifiedAt)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {c.canVerify ? 'Chưa kiểm tra' : 'Hãng chưa hỗ trợ kiểm tra'}
          </span>
        )}
      </TableCell>
      <TableCell className="px-2.5 py-2 text-sm text-muted-foreground">
        {a.updatedAt ? formatDateTime(a.updatedAt) : '—'}
      </TableCell>
      <TableCell className="px-2.5 py-2">
        <Can I="config" a="Carrier">
          <div className="flex flex-wrap items-center justify-end gap-1">
            {c.canVerify ? (
              <Button
                variant="outline"
                size="sm"
                disabled={verifying !== null}
                onClick={onVerify}
                aria-label={`Kiểm tra kết nối ${label}`}
              >
                <RefreshCw
                  className={verifying === a.id ? 'animate-spin' : undefined}
                  aria-hidden
                />
                Kiểm tra kết nối
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              aria-label={`Sửa tài khoản ${label}`}
            >
              <Pencil aria-hidden />
              Sửa
            </Button>
            {a.isDefault ? null : (
              <>
                {a.isActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`Đặt ${label} làm mặc định`}
                    onClick={() =>
                      setDefault.mutate(
                        { code: c.code, accountId: a.id },
                        {
                          onSuccess: () =>
                            toast.success('Đã đặt tài khoản mặc định', {
                              description: `${c.name} · ${a.name}`,
                            }),
                          onError: (err) => toast.error(messageFor(err)),
                        },
                      )
                    }
                  >
                    <Star aria-hidden />
                    Đặt mặc định
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={`${a.isActive ? 'Tắt' : 'Bật'} tài khoản ${label}`}
                  onClick={toggleActive}
                >
                  <Power aria-hidden />
                  {a.isActive ? 'Tắt' : 'Bật'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Xóa tài khoản ${label}`}
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 aria-hidden />
                  Xóa
                </Button>
              </>
            )}
          </div>
        </Can>
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={`Xóa tài khoản ${a.name}?`}
          description="Chỉ xóa được tài khoản chưa từng cấp vận đơn. Tài khoản đã dùng thì tắt để sale không chọn được nữa."
          confirmLabel="Xóa tài khoản"
          onConfirm={() =>
            remove
              .mutateAsync({ code: c.code, accountId: a.id })
              .then(() =>
                toast.success('Đã xóa tài khoản', { description: `${c.name} · ${a.name}` }),
              )
              .catch((err) => toast.error(messageFor(err)))
          }
        />
      </TableCell>
    </TableRow>
  );
}

function FieldRow({ field: f }: { field: CarrierSettingField }) {
  const shown = f.secret ? f.hint : f.value;
  return (
    <>
      <dt className="text-muted-foreground">{f.label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        {shown ? (
          <>
            <span className="truncate font-mono" title={shown}>
              {shown}
            </span>
            {f.source ? (
              <StatusBadge tone={f.source === 'db' ? 'brand' : 'neutral'}>
                {SOURCE_LABEL[f.source]}
              </StatusBadge>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </>
  );
}
