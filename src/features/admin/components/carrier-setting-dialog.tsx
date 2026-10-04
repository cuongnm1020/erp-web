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
  useUpdateCarrierSetting,
  type CarrierSetting,
  type CarrierSettingField,
  type UpdateCarrierSettingInput,
} from '../api/use-carrier-settings';
import { carrierSettingFormSchema, type CarrierSettingFormValues } from '../schema';

/** Giá trị đang hiệu lực, nói rõ nguồn — admin cần biết đang sửa đè env hay sửa giá trị đã nhập. */
export function currentValueText(f: CarrierSettingField): string {
  const shown = f.secret ? f.hint : f.value;
  if (!f.source || !shown) return `Chưa có — env ${f.envName} trống`;
  if (f.source === 'db') return `${shown} · nhập ở màn này`;
  if (f.source === 'env') return `${shown} · từ env ${f.envName}`;
  return `${shown} · từ cấu hình cũ (apiConfig)`;
}

/**
 * Sửa kết nối một hãng — PUT /carriers/{code}/settings. Mọi ô bắt đầu TRỐNG (giá trị hiện tại
 * ở placeholder): ô trống = giữ nguyên, gõ = thay. Bí mật không bao giờ về tới trình duyệt.
 * Trường đang lấy từ màn này có ô "Dùng lại env" để bỏ giá trị đã nhập. Lưu xong màn cha tự
 * gọi kiểm tra kết nối (`onSaved`).
 */
export function CarrierSettingDialog({
  setting,
  onOpenChange,
  onSaved,
}: {
  setting: CarrierSetting;
  onOpenChange: (open: boolean) => void;
  onSaved: (code: string) => void;
}) {
  const update = useUpdateCarrierSetting();
  const form = useForm<CarrierSettingFormValues>({
    resolver: zodResolver(carrierSettingFormSchema),
    defaultValues: {
      values: Object.fromEntries(setting.fields.map((f) => [f.key, ''])),
      clear: [],
    },
  });
  const clear = form.watch('clear');

  const onSubmit = form.handleSubmit((v) => {
    const input: UpdateCarrierSettingInput = {};
    for (const f of setting.fields) {
      const typed = v.values[f.key] ?? '';
      // Mật khẩu giữ nguyên ký tự; trường khác bỏ khoảng trắng hai đầu.
      const next = f.key === 'password' ? typed : typed.trim();
      if (v.clear.includes(f.key)) input[f.key] = null;
      else if (next) input[f.key] = next;
    }
    if (Object.keys(input).length === 0) {
      form.setError('root.server', {
        type: 'server',
        message: 'Chưa có thay đổi — nhập giá trị mới hoặc chọn "Dùng lại env".',
      });
      return;
    }
    update.mutate(
      { code: setting.code, input },
      {
        onSuccess: (saved) => {
          toast.success('Đã lưu thay đổi', {
            description: `${saved.name} · đang kiểm tra kết nối…`,
          });
          onOpenChange(false);
          onSaved(saved.code);
        },
        onError: (err) => applyServerErrors(form, err, { knownFields: [] }),
      },
    );
  });

  const rootError = form.formState.errors.root?.server?.message;
  const pending = update.isPending;

  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa kết nối {setting.name}</DialogTitle>
          <DialogDescription>
            Ô để trống = giữ nguyên. Token, tài khoản, mật khẩu được mã hoá trước khi lưu và không
            hiển thị lại. Giá trị nhập ở đây thắng biến môi trường, có hiệu lực ngay.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            {setting.secretsUnreadable ? (
              <p role="alert" className="text-sm text-destructive">
                Token / mật khẩu đã lưu không giải mã được (khoá mã hoá của server đã đổi) — nhập
                lại.
              </p>
            ) : null}
            {setting.fields.map((f, i) => {
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
                          autoFocus={i === 0}
                          disabled={clearing}
                          type={f.secret && f.key !== 'username' ? 'password' : 'text'}
                          autoComplete={f.secret ? 'new-password' : 'off'}
                          spellCheck={false}
                          placeholder={currentValueText(f)}
                          className="font-mono"
                        />
                      </FormControl>
                      {f.help ? <FormDescription>{f.help}</FormDescription> : null}
                      {f.source === 'db' ? (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={clearing}
                            aria-label={`Dùng lại env cho ${f.label}`}
                            onCheckedChange={(c) => {
                              const next = c ? [...clear, f.key] : clear.filter((k) => k !== f.key);
                              form.setValue('clear', next);
                              if (c) form.setValue(`values.${f.key}`, '');
                            }}
                          />
                          Bỏ giá trị đã nhập, dùng lại env {f.envName}
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
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
