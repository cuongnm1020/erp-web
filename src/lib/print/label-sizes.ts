/**
 * Khổ giấy / khổ tem dùng cho `PrintSheet` (`@page { size }`), mm.
 *
 * - `SKU_50x30`: cuộn tem nhiệt 2 cột (khổ cuộn ~104 mm, mỗi tem 50×30 mm, khe 2 mm) —
 *   một "trang" = một hàng 2 tem (quyết định PLAN-barcode-pick-pack 3).
 * - `A6`: nhãn vận chuyển GHTK, dọc (quyết định 2). `A5`: phiếu đơn / phiếu pick.
 * - `A5_LANDSCAPE`: một mã QR / barcode sản phẩm cỡ lớn trên A5 ngang.
 * - `WAYBILL_100x75` / `WAYBILL_75x100`: nhãn vận đơn ERP tự in cho máy in nhiệt 3 inch
 *   (tem 100×75 mm), ngang / dọc (2026-10-13).
 */
export type LabelSizeId =
  'SKU_50x30' | 'A6' | 'A5' | 'A5_LANDSCAPE' | 'WAYBILL_100x75' | 'WAYBILL_75x100';

export interface LabelSize {
  id: LabelSizeId;
  label: string;
  /** Giá trị cho `@page { size: … }`. */
  pageSize: string;
  /** Số tem trên một trang (chỉ tem SKU). */
  columns: number;
  /** Kích thước một tem, mm (chỉ tem SKU). */
  labelWidthMm?: number;
  labelHeightMm?: number;
}

export const LABEL_SIZES: Record<LabelSizeId, LabelSize> = {
  SKU_50x30: {
    id: 'SKU_50x30',
    label: 'Tem 50×30 mm · 2 cột',
    pageSize: '104mm 32mm',
    columns: 2,
    labelWidthMm: 50,
    labelHeightMm: 30,
  },
  A6: { id: 'A6', label: 'A6 dọc', pageSize: 'A6 portrait', columns: 1 },
  A5: { id: 'A5', label: 'A5 dọc', pageSize: 'A5 portrait', columns: 1 },
  // Mã QR sản phẩm cỡ lớn dán kệ / thùng (2026-10-12) — 210×148 mm.
  A5_LANDSCAPE: { id: 'A5_LANDSCAPE', label: 'A5 ngang', pageSize: 'A5 landscape', columns: 1 },
  WAYBILL_100x75: {
    id: 'WAYBILL_100x75',
    label: '100×75 mm ngang',
    pageSize: '100mm 75mm',
    columns: 1,
    labelWidthMm: 100,
    labelHeightMm: 75,
  },
  WAYBILL_75x100: {
    id: 'WAYBILL_75x100',
    label: '75×100 mm dọc',
    pageSize: '75mm 100mm',
    columns: 1,
    labelWidthMm: 75,
    labelHeightMm: 100,
  },
};
