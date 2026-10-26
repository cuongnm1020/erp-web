'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { pancakeShopLabel } from '@/components/data/pancake-shop-select';
import { SearchableMultiSelect } from '@/components/data/searchable-multi-select';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { formatDate } from '@/lib/format';
import {
  useCreateFacebookPage,
  useUpdateFacebookPage,
  type FacebookPage,
  type FacebookPageShop,
} from '../api/use-facebook-pages';

const schema = z.object({
  name: z.string().trim().min(1, 'Nhập tên page').max(200, 'Tối đa 200 ký tự'),
  externalId: z
    .string()
    .trim()
    .regex(/^(\d{5,25})?$/, 'Page ID là dãy số (5–25 chữ số)'),
  shopIds: z.array(z.string()),
  note: z.string().max(500, 'Tối đa 500 ký tự'),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

/**
 * Thêm / sửa page Facebook (mockup canvas 3r3H9T9rT1URgjzyQuuUwV màn 2). Page ID của page tự thêm
 * từ Pancake khoá (đơn đồng bộ khớp theo mã này — server 409 FACEBOOK_PAGE_ID_LOCKED).
 */
export function FacebookPageDialog({
  page,
  shops,
  open,
  onOpenChange,
}: {
  /** undefined = thêm mới. */
  page?: FacebookPage;
  shops: FacebookPageShop[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = page !== undefined;
  const idLocked = page?.origin === 'PANCAKE' && page.externalId !== null;
  const create = useCreateFacebookPage();
  const update = useUpdateFacebookPage();
  const isPending = create.isPending || update.isPending;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: page?.name ?? '',
      externalId: page?.externalId ?? '',
      shopIds: page?.shopIds ?? [],
      note: page?.note ?? '',
      isActive: page?.isActive ?? true,
    },
  });
  const shopLabel = new Map(shops.map((s) => [s.shopId, pancakeShopLabel(s)]));
  const shopOptions = shops.map((s) => ({ value: s.shopId, label: pancakeShopLabel(s) }));

  const onSubmit = form.handleSubmit((v) => {
    const body = {
      name: v.name,
      shopIds: v.shopIds,
      note: v.note.trim() || null,
      isActive: v.isActive,
      ...(idLocked ? {} : { externalId: v.externalId || null }),
    };
    const fail = (err: unknown) =>
      applyServerErrors(form, err as ApiError, {
        knownFields: ['name', 'externalId', 'shopIds', 'note'],
      });
    const done = (msg: string) => {
      toast.success(msg);
      onOpenChange(false);
    };
    if (editing) {
      update.mutate(
        { id: page.id, body: { version: page.version, ...body } },
        { onSuccess: () => done('Đã lưu thay đổi'), onError: fail },
      );
    } else {
      create.mutate(body, { onSuccess: () => done('Đã thêm page'), onError: fail });
    }
  });
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Sửa page' : 'Thêm page'}</DialogTitle>
          <DialogDescription>
            {editing
              ? page.origin === 'PANCAKE'
                ? `Tự động thêm từ đơn Pancake ngày ${formatDate(page.createdAt)}`
                : `Thêm tay ngày ${formatDate(page.createdAt)}`
              : 'Page dùng để chọn lúc lên đơn và lọc đơn theo page.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên page *</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Đất Phương Nam - CS4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="externalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Page ID Facebook</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder="Không bắt buộc"
                      className="font-mono"
                      readOnly={idLocked}
                      disabled={idLocked}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {idLocked
                      ? `Khóa vì đơn Pancake đã gắn theo mã này.${
                          page?.sourceName ? ` Tên Pancake gửi về: "${page.sourceName}".` : ''
                        }`
                      : 'Có Page ID thì đơn Pancake từ page này tự khớp vào page.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shopIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>POS kết nối</FormLabel>
                  <FormControl>
                    <SearchableMultiSelect
                      label="POS"
                      unit="POS"
                      values={field.value}
                      options={shopOptions}
                      onChange={field.onChange}
                      className="w-full"
                    />
                  </FormControl>
                  {field.value.length ? (
                    <ul className="flex flex-wrap gap-1" aria-label="POS đã chọn">
                      {field.value.map((id) => (
                        <li
                          key={id}
                          className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary pl-2 pr-1 text-xs text-primary"
                        >
                          {shopLabel.get(id) ?? `POS ${id}`}
                          <button
                            type="button"
                            aria-label={`Bỏ POS ${shopLabel.get(id) ?? id}`}
                            className="rounded-full p-0.5 hover:bg-card"
                            onClick={() => field.onChange(field.value.filter((x) => x !== id))}
                          >
                            <X className="h-3 w-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <FormDescription>
                    Lên đơn: chọn POS nào thì page của POS đó lên trước.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">
                    Đang dùng{' '}
                    <span className="text-muted-foreground">
                      — bỏ tick thì ẩn khỏi ô chọn page lúc lên đơn
                    </span>
                  </FormLabel>
                </FormItem>
              )}
            />
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button type="submit" loading={isPending} loadingText="Đang lưu…">
                {editing ? 'Lưu thay đổi' : 'Thêm page'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
