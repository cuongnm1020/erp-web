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
import { useDuplicatePancakeConfig, type PancakeShopConfig } from '../api/use-pancake-config';
import { duplicatePancakeConfigSchema, type DuplicatePancakeConfigValues } from '../schema';

/**
 * Nhân bản kết nối shop Pancake — POST /pancake-sync/config/{shopId}/duplicate.
 * Chỉ cần mã shop mới: khoá API, địa chỉ API, giới hạn, danh sách sản phẩm bán chép từ shop gốc
 * phía server (khoá không về trình duyệt). Webhook secret sinh mới — phải dán vào Pancake.
 */
export function PancakeDuplicateDialog({
  source,
  open,
  onOpenChange,
}: {
  source: PancakeShopConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const duplicate = useDuplicatePancakeConfig();
  const form = useForm<DuplicatePancakeConfigValues>({
    resolver: zodResolver(duplicatePancakeConfigSchema),
    defaultValues: {
      targetShopId: '',
      shopName: source.shopName ? `${source.shopName} (bản sao)` : '',
      apiKey: '',
      copyProducts: true,
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    duplicate.mutate(
      {
        shopId: Number(source.shopId),
        input: {
          targetShopId: Number(v.targetShopId),
          shopName: v.shopName || null,
          copyProducts: v.copyProducts,
          ...(v.apiKey ? { apiKey: v.apiKey } : {}),
        },
      },
      {
        onSuccess: (saved) => {
          toast.success('Đã nhân bản kết nối', {
            description: `Shop ${saved.shopId} · khoá ${saved.apiKeyHint} — dán URL + secret webhook mới vào Pancake`,
          });
          onOpenChange(false);
        },
        onError: (err) =>
          applyServerErrors(form, err as ApiError, {
            knownFields: ['targetShopId', 'shopName', 'apiKey', 'copyProducts'],
          }),
      },
    );
  });

  const rootError = form.formState.errors.root?.server?.message;
  const pending = duplicate.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nhân bản kết nối shop {source.shopId}</DialogTitle>
          <DialogDescription>
            Tạo kết nối shop mới dùng lại khoá API {source.apiKeyHint}, địa chỉ API và giới hạn của
            shop này. Webhook secret của shop mới được sinh riêng.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="targetShopId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Mã shop mới</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus
                      inputMode="numeric"
                      placeholder="vd: 407957969"
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>Số trên URL pos.pages.fm/shop/… của shop mới</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shopName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên gợi nhớ</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="vd: POS chi nhánh 2" />
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
                  <FormLabel>Khoá API</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={`Dùng lại khoá ${source.apiKeyHint}`}
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    Để trống để dùng lại khoá của shop gốc; nhập nếu shop mới có khoá riêng
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="copyProducts"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      aria-label="Chép danh sách sản phẩm bán"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Chép danh sách sản phẩm bán</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                {pending ? 'Đang nhân bản…' : 'Nhân bản'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
