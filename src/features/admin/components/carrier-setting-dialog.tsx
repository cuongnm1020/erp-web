'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import {
  useCreateCarrierAccount,
  useUpdateCarrierAccount,
  type CarrierAccount,
  type CarrierSetting,
  type CarrierSettingField,
  type UpdateCarrierSettingInput,
} from '../api/use-carrier-settings';
import { carrierSettingFormSchema, type CarrierSettingFormValues } from '../schema';

/** Giá trị đang hiệu lực, nói rõ nguồn — admin cần biết đang sửa đè env hay sửa giá trị đã nhập. */
export function currentValueText(f: CarrierSettingField): string {
  const shown = f.secret ? f.hint : f.value;
  if (!f.source || !shown) return f.envName ? `Chưa có — env ${f.envName} trống` : 'Chưa có';
  if (f.source === 'db') return `${shown} · nhập ở màn này`;
  if (f.source === 'env') return `${shown} · từ env ${f.envName ?? ''}`;
  return `${shown} · từ cấu hình cũ (apiConfig)`;
}

/**
 * Thêm / sửa MỘT tài khoản của hãng (FE-CARRIER-ACC-1) — POST /carriers/{code}/accounts hoặc
 * PATCH …/accounts/{id}. Mọi ô kết nối bắt đầu TRỐNG (giá trị hiện tại ở placeholder): ô trống =
 * giữ nguyên, gõ = thay. Bí mật không bao giờ về tới trình duyệt. Trường đang lấy từ màn này có ô
 * bỏ giá trị đã nhập (tài khoản mặc định: rơi về env; tài khoản phụ: trống). Lưu xong màn cha tự
 * kiểm tra kết nối tài khoản đó (`onSaved`).
 */
export function CarrierSettingDialog({
  setting,
  account,
  onOpenChange,
  onSaved,
}: {
  setting: CarrierSetting;
  /** null = thêm tài khoản mới. */
  account: CarrierAccount | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (accountId: string) => void;
}) {
  const create = useCreateCarrierAccount();
  const update = useUpdateCarrierAccount();
  // Tài khoản mới: các trường hiển thị theo tài khoản mặc định nhưng không có giá trị kế thừa.
  const fields: CarrierSettingField[] = account
    ? account.fields
    : (setting.accounts.find((a) => a.isDefault)?.fields ?? setting.fields).map((f) => ({
        ...f,
        value: null,
        hint: null,
        source: null,
        envName: f.key === 'baseUrl' ? f.envName : null,
      }));
  const form = useForm<CarrierSettingFormValues>({
    resolver: zodResolver(carrierSettingFormSchema),
    defaultValues: {
      name: account?.name ?? '',
      values: Object.fromEntries(fields.map((f) => [f.key, ''])),
      clear: [],
    },
  });
  const clear = form.watch('clear');

  const onSubmit = form.handleSubmit((v) => {
    const input: UpdateCarrierSettingInput = {};
    for (const f of fields) {
      const typed = v.values[f.key] ?? '';
      // Mật khẩu giữ nguyên ký tự; trường khác bỏ khoảng trắng hai đầu.
      const next = f.key === 'password' ? typed : typed.trim();
      if (v.clear.includes(f.key)) input[f.key] = null;
      else if (next) input[f.key] = next;
    }
    const name = v.name.trim();
    const onError = (err: unknown) => applyServerErrors(form, err, { knownFields: ['name'] });
    const onSuccess = (saved: CarrierSetting, accountId: string) => {
      toast.success(account ? 'Đã lưu thay đổi' : 'Đã thêm tài khoản', {
        description: `${saved.name} · ${name} · đang kiểm tra kết nối…`,
      });
      onOpenChange(false);
      onSaved(accountId);
    };

    if (!account) {
      create.mutate(
        { code: setting.code, input: { ...input, name } },
        {
          onSuccess: (saved) =>
            onSuccess(saved, saved.accounts.find((a) => a.name === name)?.id ?? ''),
          onError,
        },
      );
      return;
    }
    const renamed = name !== account.name;
    if (Object.keys(input).length === 0 && !renamed) {
      form.setError('root.server', {
        type: 'server',
        message: 'Chưa có thay đổi — nhập giá trị mới hoặc chọn bỏ giá trị đã nhập.',
      });
      return;
    }
    update.mutate(
      {
        code: setting.code,
        accountId: account.id,
        input: { ...input, ...(renamed ? { name } : {}) },
      },
      { onSuccess: (saved) => onSuccess(saved, account.id), onError },
    );
  });

  const rootError = form.formState.errors.root?.server?.message;
  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {account
              ? `Sửa tài khoản ${account.name} · ${setting.name}`
              : `Thêm tài khoản ${setting.name}`}
          </DialogTitle>
          <DialogDescription>
            Ô để trống = giữ nguyên. Token, tài khoản, mật khẩu được mã hoá trước khi lưu và không
            hiển thị lại.{' '}
            {account?.isDefault
              ? 'Đây là tài khoản mặc định: ô trống dùng biến môi trường của server.'
              : 'Tài khoản phụ không dùng biến môi trường (trừ địa chỉ API) — nhập đủ token / mã cửa hàng.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            {account?.secretsUnreadable ? (
              <p role="alert" className="text-sm text-destructive">
                Token / mật khẩu đã lưu không giải mã được (khoá mã hoá của server đã đổi) — nhập
                lại.
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên tài khoản</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus
                      placeholder="vd GHTK cửa hàng Thạch Thất"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormDescription>
                    Sale thấy tên này khi chọn tài khoản lúc gửi đơn.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {fields.map((f) => {
              const clearing = clear.includes(f.key);
              return (
                <FormField
                  key={f.key}
                  control={form.control}
                  name={`values.${f.key}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{f.label}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={clearing}
                          type={f.secret && f.key !== 'username' ? 'password' : 'text'}
                          autoComplete={f.secret ? 'new-password' : 'off'}
                          spellCheck={false}
                          placeholder={currentValueText(f)}
                          className="font-mono"
                        />
                      </FormControl>
                      {f.help ? <FormDescription>{f.help}</FormDescription> : null}
                      {account && f.source === 'db' ? (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={clearing}
                            aria-label={
                              f.envName
                                ? `Dùng lại env cho ${f.label}`
                                : `Xóa giá trị đã nhập cho ${f.label}`
                            }
                            onCheckedChange={(c) => {
                              const next = c ? [...clear, f.key] : clear.filter((k) => k !== f.key);
                              form.setValue('clear', next);
                              if (c) form.setValue(`values.${f.key}`, '');
                            }}
                          />
                          {f.envName
                            ? `Bỏ giá trị đã nhập, dùng lại env ${f.envName}`
                            : 'Xóa giá trị đã nhập'}
                        </label>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              );
            })}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={pending}>
                {account ? 'Lưu thay đổi' : 'Thêm tài khoản'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
