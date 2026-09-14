import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { taskKeys } from './use-tasks';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI. */
export type PdaResolveResult = components['schemas']['PdaResolveResultDto'];
export type PdaTaskRef = components['schemas']['PdaTaskRefDto'];
export type PdaTask = components['schemas']['PdaTaskDto'];
export type PdaTaskLine = components['schemas']['PdaTaskLineDto'];
export type PdaScanResult = components['schemas']['PdaScanResultDto'];
export type PdaCompleteResult = components['schemas']['PdaCompleteResultDto'];
export type PdaWaybill = components['schemas']['PdaWaybillDto'];
export type ShipmentView = components['schemas']['ShipmentViewDto'];
export type PdaShortResult = components['schemas']['PdaShortResultDto'];
export type PdaWave = components['schemas']['PdaWaveDto'];
export type PdaWaveScanResult = components['schemas']['PdaWaveScanResultDto'];
export type PdaWaveShortResult = components['schemas']['PdaWaveShortResultDto'];
export type WaybillRequestResult = components['schemas']['WaybillRequestResultDto'];

/** Phễu key: ['wms','pda', …]. */
export const pdaKeys = {
  all: ['wms', 'pda'] as const,
  task: (id: string) => [...pdaKeys.all, 'task', id] as const,
  shipment: (id: string) => [...pdaKeys.all, 'shipment', id] as const,
  wave: (id: string) => [...pdaKeys.all, 'wave', id] as const,
};

/**
 * GET /pda/resolve/:code — phân loại mã vừa quét (SKU / đơn / việc / wave / vị trí / vận đơn).
 * Là mutation vì mỗi lần quét là một hành động, không phải dữ liệu để cache.
 */
export function useResolveCode() {
  return useMutation({
    mutationFn: (code: string) =>
      unwrap(api.GET('/pda/resolve/{code}', { params: { path: { code } } })),
  });
}

/** GET /pda/tasks/:id — việc của mình hoặc chưa ai nhận (dòng đã sắp theo pickSequence). */
export function usePdaTask(taskId: string | null) {
  return useQuery({
    queryKey: pdaKeys.task(taskId ?? ''),
    queryFn: () => unwrap(api.GET('/pda/tasks/{id}', { params: { path: { id: taskId ?? '' } } })),
    enabled: taskId !== null && taskId !== '',
  });
}

/** POST /pda/tasks/:id/claim — nhận việc bằng máy quét; 409 khi người khác đang giữ. */
export function useClaimTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      unwrap(api.POST('/pda/tasks/{id}/claim', { params: { path: { id: taskId } } })),
    onSuccess: (task) => {
      qc.setQueryData(pdaKeys.task(task.taskId), task);
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export interface ScanInput {
  taskLineId: string;
  barcode: string;
  /** Số lượng theo ĐVT của barcode, CHUỖI (luật 10). */
  qty: string;
  /** Sinh lúc quét (luật 4), giữ nguyên khi retry. */
  idempotencyKey: string;
}

/** POST /pda/scan — đối chiếu, không ghi ledger. Không optimistic (luật 5): chờ server. */
export function usePdaScan() {
  return useMutation({
    mutationFn: (body: ScanInput) => unwrap(api.POST('/pda/scan', { body })),
  });
}

/** POST /pda/complete — đóng dòng; dòng PACK cuối trừ tồn + xin vận đơn (`waybill`). */
export function usePdaComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { taskLineId: string; idempotencyKey: string }) =>
      unwrap(api.POST('/pda/complete', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/**
 * GET /shipments/:id — phiếu giao (vận đơn, số lần in nhãn). Popup nhãn dùng để chờ hãng cấp
 * vận đơn khi QUEUED: `poll` → hỏi lại mỗi 5 s tới khi có `trackingNo`.
 */
export function useShipment(shipmentId: string | null, opts: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: pdaKeys.shipment(shipmentId ?? ''),
    queryFn: () =>
      unwrap(api.GET('/shipments/{id}', { params: { path: { id: shipmentId ?? '' } } })),
    enabled: shipmentId !== null && shipmentId !== '',
    refetchInterval: (q) => (opts.poll && !q.state.data?.trackingNo ? 5_000 : false),
  });
}

/** POST /shipments/:id/waybill — chọn hãng tại chỗ khi đóng gói xong mà đơn chưa gán hãng. */
export function useRequestWaybill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shipmentId, carrierCode }: { shipmentId: string; carrierCode: string }) =>
      unwrap(
        api.POST('/shipments/{id}/waybill', {
          params: { path: { id: shipmentId } },
          body: { carrierCode },
        }),
      ),
    onSuccess: (r) => void qc.invalidateQueries({ queryKey: pdaKeys.shipment(r.shipmentId) }),
  });
}

/** URL nhãn PDF (qua proxy Next, cookie httpOnly đi kèm) — nhúng vào iframe để in. */
export function labelUrl(shipmentId: string, pageSize: 'A6' | 'A5'): string {
  return `/api/shipments/${encodeURIComponent(shipmentId)}/label?pageSize=${pageSize}&orientation=portrait`;
}

/**
 * POST /pda/short — báo THIẾU HÀNG một dòng PICK: dòng → EXCEPTION với số đã lấy, phần thiếu
 * không sang đóng gói; điều phối thấy cảnh báo trên bảng điều phối và phiếu xuất.
 */
export function usePdaShort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { taskLineId: string; note?: string; idempotencyKey: string }) =>
      unwrap(api.POST('/pda/short', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

// ── Lượt pick gộp trên máy quét ────────────────────────────

/** POST /pda/waves/:id/claim — nhận cả lượt bằng máy quét. */
export function useClaimWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (waveId: string) =>
      unwrap(api.POST('/pda/waves/{id}/claim', { params: { path: { id: waveId } } })),
    onSuccess: (w) => {
      qc.setQueryData(pdaKeys.wave(w.id), w);
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/** GET /pda/waves/:id — dòng gộp + tiến độ từng đơn (của mình hoặc chưa ai nhận). */
export function usePdaWave(waveId: string | null) {
  return useQuery({
    queryKey: pdaKeys.wave(waveId ?? ''),
    queryFn: () => unwrap(api.GET('/pda/waves/{id}', { params: { path: { id: waveId ?? '' } } })),
    enabled: waveId !== null && waveId !== '',
  });
}

/** POST /pda/waves/:id/scan — quét gộp, server chia số lượng xuống từng đơn. */
export function useWaveScan() {
  return useMutation({
    mutationFn: ({
      waveId,
      ...body
    }: {
      waveId: string;
      barcode: string;
      qty: string;
      locationId?: string;
      lotId?: string;
      idempotencyKey: string;
    }) => unwrap(api.POST('/pda/waves/{id}/scan', { params: { path: { id: waveId } }, body })),
  });
}

/** POST /pda/waves/:id/short — báo thiếu cả nhóm (sku + vị trí + lô) của lượt. */
export function useWaveShort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      waveId,
      ...body
    }: {
      waveId: string;
      skuId: string;
      locationId?: string;
      lotId?: string;
      note?: string;
      idempotencyKey: string;
    }) => unwrap(api.POST('/pda/waves/{id}/short', { params: { path: { id: waveId } }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
