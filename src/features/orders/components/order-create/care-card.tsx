'use client';

import Link from 'next/link';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { PurposePicker } from '@/components/data/purpose-picker';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format';
import {
  useCreatePurposeOption,
  useOrderCustomerPurposes,
  usePurposeOptions,
  useRecentCustomerNotes,
} from '../../api/use-order-care';
import { useCareLookup, useCustomerPhoneMatch } from '../../api/use-order-create';
import type { CreateOrderValues } from '../../schema';
import { Card } from './order-side-cards';

type Form = UseFormReturn<CreateOrderValues>;

/**
 * Thẻ "Chăm sóc khách" ở màn Tạo đơn (biên bản CSKH 2026-10-26, mockup màn 3):
 *  - Khách dùng sản phẩm cho (mục đích): mục đích khách đã có bật sẵn (khóa), bấm để gắn thêm,
 *    gõ để tạo mục đích mới — lưu vào hồ sơ khách khi chốt đơn (`purposeTagIds`);
 *  - Ghi chú chăm sóc lần này (`careNote`) — vào lịch sử chăm sóc, gắn số đơn; không bắt buộc;
 *  - 2 ghi chú mới nhất của khách (khách đã có — kể cả khách tra SĐT ngoài tầm nhìn).
 */
export function CareCard({ form }: { form: Form }) {
  const customerId = useWatch({ control: form.control, name: 'customerId' });
  const phone = useWatch({ control: form.control, name: 'customerPhone' });
  const selected = useWatch({ control: form.control, name: 'purposeTagIds' });
  const careNote = useWatch({ control: form.control, name: 'careNote' });
  // Cùng cache với thẻ Khách hàng: khách trong tầm nhìn theo SĐT, không thì tra toàn hệ thống.
  const match = useCustomerPhoneMatch(customerId ? '' : phone);
  const care = useCareLookup(customerId ? '' : phone, match.data === null);
  const knownId =
    customerId || match.data?.id || (match.data === null ? care.data?.customer?.id : undefined);

  const options = usePurposeOptions();
  const existing = useOrderCustomerPurposes(knownId);
  const notes = useRecentCustomerNotes(knownId);
  const create = useCreatePurposeOption();
  const locked = (existing.data ?? []).map((p) => p.id);
  const setSelected = (next: string[]) =>
    form.setValue('purposeTagIds', next, { shouldDirty: true, shouldValidate: true });
  const err =
    form.formState.errors.careNote?.message ?? form.formState.errors.purposeTagIds?.message;

  return (
    <Card
      title="Chăm sóc khách"
      actions={
        knownId ? (
          <Link href={`/crm/customers/${knownId}`} className="text-sm text-primary hover:underline">
            Lịch sử chăm sóc{notes.data ? ` (${notes.data.total})` : ''}
          </Link>
        ) : null
      }
    >
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">
          Khách dùng sản phẩm cho (mục đích)
        </legend>
        <PurposePicker
          options={options.data ?? []}
          selected={selected}
          locked={locked}
          onToggle={(id) =>
            setSelected(
              selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
            )
          }
          creating={create.isPending}
          onCreate={async (name) => {
            try {
              const r = await create.mutateAsync(name);
              if (!selected.includes(r.purpose.id) && !locked.includes(r.purpose.id)) {
                setSelected([...selected, r.purpose.id]);
              }
            } catch (e) {
              toast.error(messageFor(e));
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Lưu vào hồ sơ khách khi chốt đơn. Mục đích mới tạo vào danh mục chung cho cả công ty.
        </p>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="order-care-note" className="text-xs font-semibold text-muted-foreground">
          Ghi chú chăm sóc lần này
        </label>
        <Textarea
          id="order-care-note"
          rows={2}
          maxLength={2000}
          value={careNote}
          onChange={(e) =>
            form.setValue('careNote', e.target.value, { shouldDirty: true, shouldValidate: true })
          }
          placeholder="Khách trồng gì, bao nhiêu ha, nhu cầu, hẹn lần sau…"
          aria-invalid={!!form.formState.errors.careNote}
        />
        {err ? (
          <p className="text-xs text-destructive" role="alert">
            {err}
          </p>
        ) : null}
      </div>

      {notes.data?.items.length ? (
        <ol className="flex flex-col border-t">
          {notes.data.items.map((n) => (
            <li key={n.id} className="border-b py-1.5 last:border-b-0">
              <div className="text-xs text-muted-foreground">
                <strong className="font-semibold text-foreground">{n.authorName}</strong>
                {n.authorDepartment ? ` · ${n.authorDepartment}` : ''} ·{' '}
                {formatDateTime(n.createdAt)}
              </div>
              <p className="line-clamp-2 text-sm" title={n.body}>
                {n.body}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
