'use client';

import Decimal from 'decimal.js';
import { Plus, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/data/states';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { ALL_WAREHOUSES, useWarehouse } from '@/lib/warehouse';
import { useUploadOrderAttachment } from '../api/use-order-create';
import { useOrder, type SalesOrderDetail } from '../api/use-orders';
import { collapseComboLines } from '../combo-lines';
import { emptyOrderValues, type CreateOrderValues } from '../schema';
import { useOrderDrafts } from '../use-order-drafts';
import {
  OrderDraftForm,
  type AfterCreate,
  type CreateOrderResult,
  type OrderDraftFormHandle,
} from './order-create/order-draft-form';

function omitKey<T>(m: Record<string, T>, key: string): Record<string, T> {
  const next = { ...m };
  delete next[key];
  return next;
}

/** Đơn cũ → giá trị form "Tạo lại đơn" (?from=). Không chép tiền chuyển khoản / giờ tạo. */
function valuesFromOrder(o: SalesOrderDetail, warehouseId: string): CreateOrderValues {
  const opts = o.shippingOptions;
  const cm = (v: number | null | undefined) => (v == null ? '' : String(v));
  return {
    ...emptyOrderValues(warehouseId),
    customerId: o.customer.id,
    customerName: o.customer.name,
    addressId: o.addressId ?? '',
    warehouseId: o.warehouseId ?? warehouseId,
    channel: o.channel,
    source: o.source ?? '',
    shippingFee: o.shippingFee,
    freeShipping: o.freeShipping,
    shipFeeOnReturnOnly: o.shipFeeOnReturnOnly,
    surcharge: new Decimal(o.surcharge).isZero() ? '' : o.surcharge,
    // Giảm tay cấp đơn của đơn cũ: theo % thì giữ %, không thì giữ số tiền.
    ...(o.manualDiscountRate
      ? {
          manualDiscountType: 'PERCENT' as const,
          manualDiscountValue: new Decimal(o.manualDiscountRate).mul(100).toString(),
        }
      : {
          manualDiscountType: 'AMOUNT' as const,
          manualDiscountValue: new Decimal(o.manualDiscount || 0).isZero()
            ? ''
            : new Decimal(o.manualDiscount).toString(),
        }),
    packerId: o.packerId ?? '',
    careStaffId: o.careStaffId ?? '',
    marketerId: o.marketerId ?? '',
    tagIds: o.tags.map((t) => t.id),
    internalNote: o.internalNote ?? '',
    printNote: o.printNote ?? '',
    carrierId: o.carrierId ?? '',
    carrierAccountId: o.carrierAccountId ?? '',
    shippingWeightKg: o.shippingWeightKg ?? '',
    lengthCm: cm(opts?.lengthCm),
    widthCm: cm(opts?.widthCm),
    heightCm: cm(opts?.heightCm),
    // Dòng quà do KM sinh — engine sẽ tự sinh lại nếu còn KM; dòng thành phần combo gộp về một
    // dòng combo (server bung lại khi chốt).
    lines: collapseComboLines(o.lines.filter((l) => !l.isGift)).map((l) => ({
      skuId: l.skuId,
      uomId: l.uomId,
      qty: l.qty,
      discountPercent: '',
    })),
  };
}

/**
 * D-01 Tạo đơn — màn tạo đơn mới (2026-10-17, bố cục Pancake đã duyệt): nhiều tab đơn nháp
 * (F6), giỏ hàng tìm / quét mã (F9), chốt đơn (F10). Mỗi tab là một `OrderDraftForm`; nháp lưu
 * trên máy (localStorage), tệp đính kèm giữ trong phiên và tải lên ngay sau khi chốt.
 * ?from=<orderId>: tạo lại từ đơn cũ (sửa = hủy & tạo lại); ?customerId=<id>: vào từ nút "Tạo
 * đơn" của hồ sơ khách — chọn sẵn khách.
 */
export function OrderCreateScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const fromId = search.get('from') ?? '';
  const presetCustomerId = search.get('customerId') ?? '';
  const { selected: workingWarehouse } = useWarehouse();
  // Kho đang làm việc (ô chọn kho ở sidebar); "Tất cả kho" → để server lấy kho mặc định.
  const defaultWh = workingWarehouse && workingWarehouse !== ALL_WAREHOUSES ? workingWarehouse : '';
  const drafts = useOrderDrafts(defaultWh);
  const { openDraft, closeDraft, activate, updateValues } = drafts;
  const source = useOrder(fromId);
  const upload = useUploadOrderAttachment();
  const formRef = useRef<OrderDraftFormHandle>(null);
  const [files, setFiles] = useState<Record<string, File[]>>({});

  // Mở tab từ link (?from / ?customerId) một lần, sau khi đã đọc nháp cũ.
  const seeded = useRef(false);
  useEffect(() => {
    if (!drafts.ready || seeded.current) return;
    if (fromId) {
      if (!source.data) return;
      seeded.current = true;
      openDraft(valuesFromOrder(source.data, defaultWh), `from:${fromId}`);
    } else if (presetCustomerId) {
      seeded.current = true;
      openDraft(
        { ...emptyOrderValues(defaultWh), customerId: presetCustomerId },
        `customer:${presetCustomerId}`,
      );
    } else {
      seeded.current = true;
    }
  }, [drafts.ready, fromId, presetCustomerId, source.data, defaultWh, openDraft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        e.preventDefault();
        openDraft();
      } else if (e.key === 'F9') {
        e.preventDefault();
        formRef.current?.focusSearch();
      } else if (e.key === 'F10') {
        e.preventDefault();
        formRef.current?.submit('open');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDraft]);

  const activeId = drafts.active.id;
  const onValuesChange = useCallback(
    (values: CreateOrderValues) => updateValues(activeId, values),
    [activeId, updateValues],
  );

  const onCreated = async (r: CreateOrderResult, mode: AfterCreate) => {
    const draftId = activeId;
    if (r.status === 'PENDING_APPROVAL') {
      toast.success(`Đã gửi duyệt đơn ${r.docNumber}`, {
        description: 'Đơn vượt ngưỡng duyệt — chờ quản lý xác nhận.',
      });
    } else {
      toast.success(`Đã chốt đơn ${r.docNumber}`, { description: 'Hàng đã được giữ cho đơn này.' });
    }
    // Tệp đính kèm: đơn đã chốt rồi mới tải (cần id đơn). Hỏng tệp nào báo tệp đó, đơn vẫn giữ.
    const pending = files[draftId] ?? [];
    let failed = 0;
    for (const file of pending) {
      try {
        await upload.mutateAsync({ orderId: r.orderId, file });
      } catch {
        failed++;
      }
    }
    if (failed > 0) {
      toast.error(`${failed} tệp chưa tải lên được`, {
        description: `Đơn ${r.docNumber} đã chốt — mở đơn để đính kèm lại.`,
      });
    }
    setFiles((m) => omitKey(m, draftId));
    closeDraft(draftId);
    if (mode === 'next') openDraft();
    else router.push(`/crm/orders/${r.orderId}`);
  };

  if (fromId && source.isError) {
    return (
      <ErrorState
        title="Không tải được đơn cũ để tạo lại"
        error={source.error}
        onRetry={() => void source.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">Tạo đơn hàng</h1>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Đơn đang soạn">
        {drafts.drafts.map((d) => {
          const isActive = d.id === activeId;
          const title = d.values.customerName.trim() || `Đơn mới ${d.no}`;
          return (
            <div
              key={d.id}
              className={cn(
                'flex h-9 items-center rounded-lg border text-sm',
                isActive
                  ? 'border-border bg-card font-semibold text-primary'
                  : 'border-transparent text-muted-foreground',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => activate(d.id)}
                className="max-w-[220px] truncate px-3"
              >
                {title}
                {d.no === 1 && drafts.drafts.length === 1 ? ' (F6)' : ''}
              </button>
              {drafts.drafts.length > 1 || d.values.lines.length > 0 ? (
                <button
                  type="button"
                  aria-label={`Đóng ${title}`}
                  title="Đóng tab (nháp bị bỏ)"
                  onClick={() => {
                    setFiles((m) => omitKey(m, d.id));
                    closeDraft(d.id);
                  }}
                  className="mr-1 rounded p-1 hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => openDraft()}
          aria-label="Thêm tab đơn mới (F6)"
          title="Thêm tab đơn mới (F6)"
          className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card hover:bg-muted"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {!drafts.ready || (fromId && !seeded.current) ? (
        <div className="flex flex-wrap gap-4" aria-busy="true" aria-label="Đang tải">
          <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : (
        <OrderDraftForm
          key={activeId}
          ref={formRef}
          initialValues={drafts.active.values}
          files={files[activeId] ?? []}
          onFilesChange={(next) => setFiles((m) => ({ ...m, [activeId]: next }))}
          onValuesChange={onValuesChange}
          onCreated={(r, mode) => void onCreated(r, mode)}
        />
      )}
    </div>
  );
}
