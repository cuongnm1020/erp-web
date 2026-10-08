'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { consentRecordSchema } from '@/lib/shared';
import { useRecordConsent, type ConsentChannel } from '../api/use-consents';
import {
  CONSENT_CHANNELS,
  CONSENT_SOURCE_LABEL,
  consentChannelLabel,
  MANUAL_CONSENT_SOURCES,
} from '../consent-labels';

type Values = z.infer<typeof consentRecordSchema>;

const FIELDS = ['channel', 'granted', 'source', 'purpose', 'evidence'] as const;

/**
 * Ghi một bản đồng ý / từ chối — POST /customers/{id}/consents (append-only, customer.update).
 * Mỗi lần ghi là một bằng chứng mới theo NĐ 13/2023: nguồn + ghi chú bằng chứng + người ghi +
 * thời điểm (server tự điền hai thứ cuối). Không sửa / xóa bản cũ — đổi ý thì ghi bản mới.
 */
export function ConsentRecordDialog({
  customerId,
  open,
  onOpenChange,
  initialChannel,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialChannel?: ConsentChannel;
}) {
  const record = useRecordConsent(customerId);
  const form = useForm<Values>({
    resolver: zodResolver(consentRecordSchema),
    defaultValues: {
      channel: initialChannel ?? 'EMAIL',
      granted: 'true',
      source: 'PHONE',
      purpose: 'MARKETING',
      evidence: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        channel: initialChannel ?? 'EMAIL',
        granted: 'true',
        source: 'PHONE',
        purpose: 'MARKETING',
        evidence: '',
      });
      record.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ reset khi mở dialog
  }, [open, initialChannel]);

  const submit = form.handleSubmit((v) => {
    const granted = v.granted === 'true';
    record.mutate(
      {
        channel: v.channel,
        granted,
        source: v.source,
        purpose: v.purpose,
        evidence: v.evidence || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Đã ghi nhận đồng ý nhận tin', {
            description: `${consentChannelLabel(v.channel)}: ${granted ? 'Đồng ý' : 'Từ chối'}`,
          });
          onOpenChange(false);
        },
        onError: (err) => applyServerErrors(form, err, { knownFields: FIELDS }),
      },
    );
  });

  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !record.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ghi nhận đồng ý nhận tin</DialogTitle>
          <DialogDescription>
            Mỗi lần ghi là một bằng chứng mới, không sửa bản cũ. Chỉ kênh “Đồng ý” mới được gửi tin
            marketing.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation();
              void submit(e);
            }}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kênh</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger aria-label="Kênh">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONSENT_CHANNELS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {consentChannelLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nguồn</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger aria-label="Nguồn">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MANUAL_CONSENT_SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {CONSENT_SOURCE_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="granted"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Khách</FormLabel>
                  <div role="radiogroup" aria-label="Khách" className="flex gap-2">
                    {(
                      [
                        ['true', 'Đồng ý nhận tin'],
                        ['false', 'Từ chối / rút lại'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === value}
                        onClick={() => field.onChange(value)}
                        className={cn(
                          'h-9 flex-1 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          field.value === value
                            ? value === 'true'
                              ? 'border-success bg-success/10 font-semibold text-success'
                              : 'border-destructive bg-destructive/10 font-semibold text-destructive'
                            : 'border-input bg-card',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mục đích</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono text-xs" autoComplete="off" />
                  </FormControl>
                  <FormDescription>
                    Mặc định MARKETING — tin khuyến mãi, chiến dịch.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="evidence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú bằng chứng</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Số phiếu, mã cuộc gọi, link ảnh form…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={record.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={record.isPending}>
                {record.isPending ? 'Đang ghi…' : 'Ghi nhận'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
