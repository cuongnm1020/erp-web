'use client';

import { useEffect, useState } from 'react';
import { FormSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
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
import { formatDateTime } from '@/lib/format';
import { useHotkey } from '@/lib/use-hotkey';
import {
  useEInvoiceSettings,
  useUpdateEInvoiceSettings,
  useVerifyEInvoiceSettings,
  type EInvoiceSetting,
  type EInvoiceVerifyResult,
  type UpdateEInvoiceSettingInput,
} from '../api/use-einvoices';

/**
 * Cài đặt kết nối MISA meInvoice (canvas CVnCtWbPyUCdn7pppHaRWX màn 6) — quyền `einvoice.config`.
 * ClientSecret / mật khẩu chỉ gửi khi nhập mới (server mã hóa, không trả lại bản rõ). "Kiểm tra kết
 * nối" lấy token + danh sách mẫu → chọn mẫu / ký hiệu dùng cho ERP.
 */
export function EInvoiceSettingsScreen() {
  const query = useEInvoiceSettings();
  return (
    <QueryState query={query} skeleton={<FormSkeleton />}>
      {(s) => <SettingsForm s={s} />}
    </QueryState>
  );
}

type Plain = Pick<
  EInvoiceSetting,
  'baseUrl' | 'clientId' | 'taxCode' | 'username' | 'templateId' | 'invSeries'
>;

function SettingsForm({ s }: { s: EInvoiceSetting }) {
  const update = useUpdateEInvoiceSettings();
  const verify = useVerifyEInvoiceSettings();
  const [form, setForm] = useState<Plain>(s);
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [twoPeople, setTwoPeople] = useState(s.requireTwoPeople);
  const [result, setResult] = useState<EInvoiceVerifyResult | null>(null);
  useEffect(() => {
    setForm(s);
    setTwoPeople(s.requireTwoPeople);
  }, [s]);

  const dirty =
    (Object.keys(form) as (keyof Plain)[]).some((k) => (form[k] ?? '') !== (s[k] ?? '')) ||
    !!secret ||
    !!password ||
    twoPeople !== s.requireTwoPeople;

  const save = (extra: Partial<UpdateEInvoiceSettingInput> = {}) => {
    const body: UpdateEInvoiceSettingInput = {
      baseUrl: form.baseUrl,
      clientId: form.clientId ?? null,
      taxCode: form.taxCode ?? null,
      username: form.username ?? null,
      templateId: form.templateId ?? null,
      invSeries: form.invSeries ?? null,
      requireTwoPeople: twoPeople,
      ...(secret ? { clientSecret: secret } : {}),
      ...(password ? { password } : {}),
      ...extra,
    };
    update.mutate(body, {
      onSuccess: () => {
        setSecret('');
        setPassword('');
        toast.success('Đã lưu thay đổi');
      },
      onError: (e) => toast.error(messageFor(e)),
    });
  };
  useHotkey('mod+s', (e) => {
    e.preventDefault();
    if (dirty) save();
  });

  const field = (k: keyof Plain, label: string, mono = false) => (
    <div className="space-y-1">
      <Label htmlFor={`misa-${k}`}>{label}</Label>
      <Input
        id={`misa-${k}`}
        className={mono ? 'font-mono' : undefined}
        value={form[k] ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
      />
    </div>
  );

  const connected = s.lastVerifiedAt && !s.lastVerifyError;
  return (
    <>
      <PageHeader
        title="Hóa đơn điện tử — MISA meInvoice"
        breadcrumb={[
          { label: 'Tài chính', href: '/fin/invoices' },
          { label: 'Hóa đơn điện tử', href: '/fin/einvoices' },
          { label: 'Cài đặt' },
        ]}
        status={
          s.lastVerifiedAt ? (
            <StatusBadge tone={connected ? 'ok' : 'err'}>
              {connected ? 'Đã kết nối' : 'Kết nối lỗi'}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Chưa kiểm tra</StatusBadge>
          )
        }
        description={
          s.lastVerifiedAt
            ? `Kiểm tra lần cuối ${formatDateTime(s.lastVerifiedAt)}`
            : 'Nhập thông tin MISA cấp rồi bấm Kiểm tra kết nối'
        }
        actions={
          <Button
            disabled={!dirty}
            loading={update.isPending}
            onClick={() => save()}
            shortcut="Ctrl S"
          >
            Lưu thay đổi
          </Button>
        }
      />
      {s.secretsUnreadable ? (
        <div className="mb-3 rounded-lg border border-destructive-line bg-destructive-weak px-3 py-2 text-sm">
          <b className="text-destructive">Chặn</b> ClientSecret / mật khẩu đã lưu không đọc được
          (khóa máy chủ đã đổi) — nhập lại rồi lưu.
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-3">
        <section className="min-w-0 flex-[1_1_32rem] rounded-lg border bg-card">
          <h2 className="flex min-h-11 items-center border-b px-3.5 text-sm font-bold">Kết nối</h2>
          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 p-3.5 md:grid-cols-2">
            <div className="md:col-span-2">{field('baseUrl', 'Địa chỉ API (MISA cấp)', true)}</div>
            {field('taxCode', 'Mã số thuế người bán', true)}
            {field('clientId', 'ClientID', true)}
            <div className="space-y-1">
              <Label htmlFor="misa-secret">
                ClientSecret{' '}
                <span className="font-normal text-muted-foreground">
                  {s.hasClientSecret ? '· đã lưu, để trống nếu không đổi' : '· chưa nhập'}
                </span>
              </Label>
              <PasswordInput
                id="misa-secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
              />
            </div>
            {field('username', 'Tài khoản meInvoice')}
            <div className="space-y-1">
              <Label htmlFor="misa-password">
                Mật khẩu{' '}
                <span className="font-normal text-muted-foreground">
                  {s.hasPassword ? '· đã lưu, để trống nếu không đổi' : '· chưa nhập'}
                </span>
              </Label>
              <PasswordInput
                id="misa-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">
              Nên tạo một tài khoản riêng trên meInvoice cho ERP. ClientSecret và mật khẩu được mã
              hóa, không hiện lại sau khi lưu.
            </p>
            <div className="md:col-span-2">
              <Button
                variant="outline"
                disabled={dirty}
                loading={verify.isPending}
                title={dirty ? 'Lưu thay đổi trước khi kiểm tra' : undefined}
                onClick={() =>
                  verify.mutate(undefined, {
                    onSuccess: (r) => {
                      setResult(r);
                      if (r.ok) toast.success(`Đã kết nối MISA: ${r.templates.length} mẫu hóa đơn`);
                      else toast.error('Không kết nối được MISA — xem lỗi bên dưới');
                    },
                    onError: (e) => toast.error(messageFor(e)),
                  })
                }
              >
                Kiểm tra kết nối
              </Button>
            </div>
          </div>
          {s.lastVerifyError ? (
            <div className="border-t px-3.5 py-2.5 text-sm">
              <StatusBadge tone="err">Lỗi</StatusBadge>{' '}
              <span className="break-words">{s.lastVerifyError}</span>
            </div>
          ) : null}
        </section>

        <div className="flex min-w-0 flex-[1_1_32rem] flex-col gap-3">
          <section className="overflow-hidden rounded-lg border bg-card">
            <h2 className="flex min-h-11 items-center border-b px-3.5 text-sm font-bold">
              Mẫu / ký hiệu hóa đơn
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Đang dùng: <span className="font-mono">{s.invSeries ?? 'chưa chọn'}</span>
              </span>
            </h2>
            {result?.templates.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="px-2.5 text-xs">Ký hiệu</TableHead>
                    <TableHead className="px-2.5 text-xs">Tên mẫu</TableHead>
                    <TableHead className="px-2.5 text-xs">Nhiều thuế suất</TableHead>
                    <TableHead className="px-2.5 text-xs">
                      <span className="sr-only">Chọn</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.templates.map((t) => {
                    const current = t.templateId === s.templateId;
                    return (
                      <TableRow key={t.templateId}>
                        <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                          {t.invSeries}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {t.templateName ?? '—'}
                          {t.inactive ? (
                            <StatusBadge tone="neutral" className="ml-2">
                              Ngừng dùng
                            </StatusBadge>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {t.isMoreVatRate ? 'Có' : 'Không'}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          {current ? (
                            <StatusBadge tone="brand">Đang dùng</StatusBadge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={t.inactive || update.isPending}
                              onClick={() =>
                                save({ templateId: t.templateId, invSeries: t.invSeries })
                              }
                            >
                              Dùng mẫu này
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="px-3.5 py-3 text-sm text-muted-foreground">
                Bấm Kiểm tra kết nối để tải danh sách mẫu từ MISA, hoặc nhập tay ID mẫu + ký hiệu
                bên dưới.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 border-t p-3.5 md:grid-cols-2">
              {field('templateId', 'ID mẫu (IPTemplateID)', true)}
              {field('invSeries', 'Ký hiệu', true)}
            </div>
          </section>

          <section className="rounded-lg border bg-card">
            <h2 className="flex min-h-11 items-center border-b px-3.5 text-sm font-bold">
              Quy tắc
            </h2>
            <div className="space-y-2.5 p-3.5 text-sm">
              <label className="flex items-start gap-2">
                <Checkbox checked={twoPeople} onCheckedChange={(v) => setTwoPeople(v === true)} />
                <span>
                  <b>Duyệt 2 người</b> — người duyệt hóa đơn không được tự đẩy lên MISA
                </span>
              </label>
              <p className="text-muted-foreground">
                Chế độ: đẩy nháp — kế toán ký (USB token) và phát hành trên meInvoice, ERP lấy số
                hóa đơn về. Phí giao hàng không lên hóa đơn; giảm giá cấp đơn trừ vào từng dòng;
                tiền tách ngược từ số khách trả.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
