'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { codeSchema, idSchema, phoneSchema } from '@/lib/shared';
import { useQuickCreateCustomer, useTeams } from '../api/use-line-entry';

/** Khớp CreateCustomerDto (luật 11) — chỉ các trường tối thiểu cho tạo nhanh giữa lúc lên đơn. */
const quickCustomerSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1, 'Nhập tên khách').max(300, 'Tối đa 300 ký tự'),
  phone: phoneSchema.optional().or(z.literal('')),
  teamId: idSchema.or(z.literal('')).refine((v) => v !== '', 'Chọn team chăm sóc'),
});
type QuickCustomerValues = z.infer<typeof quickCustomerSchema>;

/**
 * Tạo nhanh khách hàng ngay trong form lên đơn — hồ sơ đầy đủ (địa chỉ, hạn mức…) bổ sung
 * sau ở màn khách hàng. Mã KH nhập tay (backend chưa cấp mã tự động cho khách).
 */
export function QuickCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: { id: string; name: string }) => void;
}) {
  const teams = useTeams();
  const create = useQuickCreateCustomer();
  const form = useForm<QuickCustomerValues>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: { code: '', name: '', phone: '', teamId: '' },
  });

  const onSubmit = form.handleSubmit((v) => {
    create.mutate(
      { code: v.code, name: v.name, teamId: v.teamId, ...(v.phone ? { phone: v.phone } : {}) },
      {
        onSuccess: (c) => {
          toast.success('Đã tạo khách hàng', { description: `${c.code} · ${c.name}` });
          onCreated({ id: c.id, name: c.name });
          form.reset();
          onOpenChange(false);
        },
        onError: (err) =>
          applyServerErrors(form, err as ApiError, {
            knownFields: ['code', 'name', 'phone', 'teamId'],
          }),
      },
    );
  });

  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo nhanh khách hàng</DialogTitle>
          <DialogDescription>
            Đủ để lên đơn ngay; hồ sơ đầy đủ bổ sung sau ở màn Khách hàng.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation(); // đừng submit form lên đơn bọc ngoài
              void onSubmit(e);
            }}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên khách hàng</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Cửa hàng An Nhiên" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã KH</FormLabel>
                    <FormControl>
                      <Input placeholder="KH-00123" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SĐT</FormLabel>
                    <FormControl>
                      <Input inputMode="tel" placeholder="0936481220" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team chăm sóc</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(teams.data ?? [])
                        .filter((t) => t.type === 'SALES')
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={create.isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Đang lưu…' : 'Tạo khách hàng'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
