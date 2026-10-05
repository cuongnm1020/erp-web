'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
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
import { StatusBadge } from '@/components/data/status-badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import { formatDateTime, formatMoney } from '@/lib/format';
import { tierPromotionSchema } from '@/lib/shared';
import { useRunTierPromotion, type TierPromotionResult } from '../api/use-segments';

type Values = { periodMonths: string; allowDemotion: boolean };

/** Hiển thị tối đa chừng này dòng thay đổi trong bản xem trước — đủ để soát, không treo trình duyệt. */
const PREVIEW_ROWS = 200;

/**
 * "Chạy nâng hạng" — POST /customer-tiers/promotion/run, HAI BƯỚC:
 *  1. Xem trước (`dryRun: true`): API tính và trả số nâng / hạ / giữ + danh sách thay đổi, không ghi.
 *  2. Chạy thật (`dryRun: false`) với ĐÚNG kỳ `from`/`to` của bản xem trước — để số ghi xuống
 *     khớp số người dùng vừa duyệt (không trượt cửa sổ theo giờ bấm).
 * Đổi tham số sau khi xem trước → bỏ bản xem trước, phải xem lại. Chỉ tác động khách trong scope
 * của người bấm (API tự scope). Quyền customer.assign — màn gọi tự bọc <Can>.
 */
export function TierPromotionDialog({
  tiersConfigured,
  open,
  onOpenChange,
}: {
  tiersConfigured: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunTierPromotion();
  const [preview, setPreview] = useState<TierPromotionResult | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(tierPromotionSchema),
    defaultValues: { periodMonths: '12', allowDemotion: false },
  });

  const doPreview = form.handleSubmit((v) => {
    run.mutate(
      {
        periodMonths: Number.parseInt(v.periodMonths, 10),
        allowDemotion: v.allowDemotion,
        dryRun: true,
      },
      {
        onSuccess: setPreview,
        onError: (err) =>
          applyServerErrors(form, err as ApiError, {
            knownFields: ['periodMonths', 'allowDemotion'],
          }),
      },
    );
  });

  const doRun = () => {
    if (!preview) return;
    run.mutate(
      { from: preview.from, to: preview.to, allowDemotion: preview.allowDemotion, dryRun: false },
      {
        onSuccess: (res) => {
          toast.success('Đã chạy nâng hạng', {
            description: `${res.promoted} khách được nâng · ${res.demoted} khách bị hạ · ${res.unchanged} giữ nguyên`,
          });
          onOpenChange(false);
        },
        onError: (err) =>
          applyServerErrors(form, err as ApiError, { knownFields: ['periodMonths'] }),
      },
    );
  };

  const rootError = form.formState.errors.root?.server?.message;
  const changes = preview?.changes ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !run.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chạy nâng hạng</DialogTitle>
          <DialogDescription>
            Tính doanh số kỳ của từng khách bạn được xem rồi xếp cấp theo ngưỡng. Luôn xem trước —
            chưa ghi gì cho tới khi bấm “Chạy nâng hạng”.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation();
              void doPreview(e);
            }}
            className="flex flex-wrap items-end gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="periodMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kỳ doanh số (tháng gần nhất)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setPreview(null);
                      }}
                      inputMode="numeric"
                      className="w-28"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowDemotion"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1">
                  <div className="flex h-9 items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(c) => {
                          field.onChange(c === true);
                          setPreview(null);
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Cho phép hạ cấp</FormLabel>
                  </div>
                  <FormDescription>
                    Bỏ chọn = chỉ nâng, khách chưa đạt ngưỡng giữ cấp
                  </FormDescription>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={run.isPending || tiersConfigured === 0}
            >
              {run.isPending && !preview ? 'Đang tính…' : 'Xem trước'}
            </Button>
          </form>
        </Form>

        {tiersConfigured === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có cấp độ nào — thêm cấp kèm ngưỡng doanh số trước khi chạy nâng hạng.
          </p>
        ) : null}
        {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}

        {preview ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Kỳ {formatDateTime(preview.from)} → trước {formatDateTime(preview.to)} ·{' '}
              {preview.tiersConfigured} cấp độ · {preview.allowDemotion ? 'có hạ cấp' : 'chỉ nâng'}
            </p>
            <dl className="grid grid-cols-4 gap-2" aria-label="Kết quả xem trước">
              {[
                ['Khách được xét', preview.customersEvaluated],
                ['Được nâng', preview.promoted],
                ['Bị hạ', preview.demoted],
                ['Giữ nguyên', preview.unchanged],
              ].map(([label, n]) => (
                <div key={label} className="rounded-md border px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{n}</dd>
                </div>
              ))}
            </dl>
            {changes.length === 0 ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                Không có khách nào đổi cấp với tham số này.
              </p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="px-2.5 text-xs">Mã KH</TableHead>
                      <TableHead className="px-2.5 text-right text-xs">Doanh số kỳ</TableHead>
                      <TableHead className="px-2.5 text-xs">Cấp hiện tại</TableHead>
                      <TableHead className="px-2.5 text-xs">Cấp mới</TableHead>
                      <TableHead className="px-2.5 text-xs">Thay đổi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changes.slice(0, PREVIEW_ROWS).map((c) => (
                      <TableRow key={c.customerId}>
                        <TableCell className="px-2.5 py-1">
                          <Link
                            href={`/crm/customers/${c.customerId}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {c.customerCode}
                          </Link>
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-right tabular-nums">
                          {formatMoney(c.revenue, { unit: '' })}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 font-mono text-xs">
                          {c.fromTierCode ?? '—'}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 font-mono text-xs">
                          {c.toTierCode}
                        </TableCell>
                        <TableCell className="px-2.5 py-1">
                          {c.direction === 'PROMOTE' ? (
                            <StatusBadge tone="ok">Nâng</StatusBadge>
                          ) : (
                            <StatusBadge tone="warn">Hạ</StatusBadge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {changes.length > PREVIEW_ROWS ? (
                  <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                    và {changes.length - PREVIEW_ROWS} khách khác
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={run.isPending}
            onClick={() => onOpenChange(false)}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            disabled={!preview || changes.length === 0 || run.isPending}
            onClick={doRun}
          >
            {run.isPending && preview ? 'Đang chạy…' : 'Chạy nâng hạng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
