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
import type { ApiError } from '@/lib/api/errors';
import {
  useUpsertPancakeConfig,
  type PancakeShopConfig,
  type UpsertPancakeConfigInput,
} from '../api/use-pancake-config';
import {
  createPancakeConfigSchema,
  pancakeConfigFormSchema,
  type PancakeConfigFormValues,
} from '../schema';

const FIELDS = [
  'shopId',
  'shopName',
  'apiKey',
  'baseUrl',
  'requestsPerSecond',
  'burst',
  'isActive',
] as const;

/**
 * Thêm / sửa kết nối một shop Pancake — PUT /pancake-sync/config/{shopId}.
 * Mã shop bất biến sau khi tạo. Khoá API chỉ đi lên, không bao giờ được hiển thị lại:
 * khi sửa, ô khoá để trống = giữ khoá đang lưu (server chỉ biết 4 ký tự cuối).
 */
export function PancakeConfigDialog({
  open,
  onOpenChange,
  config,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Có = sửa; không = tạo mới. */
  config?: PancakeShopConfig;
}) {
  const editing = config !== undefined;
  const upsert = useUpsertPancakeConfig();

  const form = useForm<PancakeConfigFormValues>({
    resolver: zodResolver(editing ? pancakeConfigFormSchema : createPancakeConfigSchema),
    defaultValues: {
      shopId: config?.shopId ?? '',
      shopName: config?.shopName ?? '',
      apiKey: '',
      baseUrl: config?.baseUrl ?? '',
      requestsPerSecond: config?.requestsPerSecond?.toString() ?? '',
      burst: config?.burst?.toString() ?? '',
      isActive: config?.isActive ?? true,
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    const input: UpsertPancakeConfigInput = {
      shopName: v.shopName || null,
      baseUrl: v.baseUrl || null,
      requestsPerSecond: v.requestsPerSecond ? Number(v.requestsPerSecond) : null,
      burst: v.burst ? Number(v.burst) : null,
      isActive: v.isActive,
      ...(v.apiKey ? { apiKey: v.apiKey } : {}),
    };
    upsert.mutate(
      { shopId: Number(v.shopId), input },
      {
        onSuccess: (saved) => {
          toast.success(editing ? 'Đã lưu thay đổi' : 'Đã thêm shop', {
            description: `Shop ${saved.shopId}${saved.shopName ? ` · ${saved.shopName}` : ''} · khoá ${saved.apiKeyHint}`,
          });
          form.reset();
          onOpenChange(false);
        },
        onError: (err) => applyServerErrors(form, err as ApiError, { knownFields: [...FIELDS] }),
      },
    );
  });

  const rootError = form.formState.errors.root?.server?.message;
  const pending = upsert.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Sửa kết nối shop ${config.shopId}` : 'Thêm shop Pancake'}
          </DialogTitle>
          <DialogDescription>
            Mã shop và khoá API lấy ở Pancake POS › Cài đặt › API. Khoá được mã hoá trước khi lưu và
            không hiển thị lại.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            {editing ? null : (
              <FormField
                control={form.control}
                name="shopId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Mã shop</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        inputMode="numeric"
                        placeholder="vd: 407957969"
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      Số trên URL pos.pages.fm/shop/… — không đổi được sau khi tạo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="shopName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên gợi nhớ</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus={editing} placeholder="vd: Shop chính" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required={!editing}>Khoá API</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        editing ? `Đang dùng khoá ${config.apiKeyHint}` : 'Dán khoá API từ Pancake'
                      }
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    {editing
                      ? 'Để trống để giữ khoá hiện tại'
                      : 'Chỉ lưu bản mã hoá; sau khi lưu chỉ thấy 4 ký tự cuối'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Địa chỉ API</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://pos.pages.fm/api/v1"
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>Để trống dùng địa chỉ mặc định của Pancake</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="requestsPerSecond"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giới hạn request/giây</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" placeholder="Mặc định 2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="burst"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Burst</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" placeholder="Mặc định 4" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {editing ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Đang bật</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
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
                {editing ? 'Lưu thay đổi' : 'Thêm shop'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
