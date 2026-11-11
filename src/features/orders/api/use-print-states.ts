import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { PrintState } from '@/features/wms/print-guard';

/** Trạng thái in của một đơn đọc ngay trước khi in (PRINT-DUP-1). */
export interface OrderPrintState extends PrintState {
  orderId: string;
  docNumber: string;
  customerName: string;
  marketplace: string | null;
  shipment: { id: string; trackingNo: string | null; status: string } | null;
}

const PAGE = 200;

/**
 * Trạng thái in MỚI NHẤT của các đơn (GET /sales-orders?ids=, tối đa 200 một lượt) — đọc ngay trước
 * khi gán NV đóng hàng / in, để hai người cùng in một lô từ danh sách cũ vẫn bị chặn. Chỉ đọc.
 */
export function usePrintStates() {
  return useMutation({
    mutationFn: async (orderIds: string[]): Promise<Map<string, OrderPrintState>> => {
      const ids = [...new Set(orderIds)];
      const out = new Map<string, OrderPrintState>();
      for (let i = 0; i < ids.length; i += PAGE) {
        const chunk = ids.slice(i, i + PAGE);
        const res = await unwrap(
          api.GET('/sales-orders', {
            params: { query: { ids: chunk, take: chunk.length, skip: 0 } },
          }),
        );
        for (const o of res.items) {
          out.set(o.id, {
            orderId: o.id,
            docNumber: o.docNumber,
            customerName: o.customer.name,
            marketplace: o.marketplace ?? null,
            labelPrintedAt: o.labelPrintedAt,
            packerName: o.packerName,
            shipment: o.shipment
              ? { id: o.shipment.id, trackingNo: o.shipment.trackingNo, status: o.shipment.status }
              : null,
          });
        }
      }
      return out;
    },
  });
}
