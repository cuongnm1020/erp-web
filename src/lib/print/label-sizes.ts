/**
 * Khổ giấy / khổ tem dùng cho `PrintSheet` (`@page { size }`), mm.
 *
 * - `SKU_50x30`: cuộn tem nhiệt 2 cột (khổ cuộn ~104 mm, mỗi tem 50×30 mm, khe 2 mm) —
 *   một "trang" = một hàng 2 tem (quyết định PLAN-barcode-pick-pack 3).
 * - `A6`: nhãn vận chuyển GHTK, dọc (quyết định 2). `A5`: phiếu đơn / phiếu pick.
 */
export type LabelSizeId = 'SKU_50x30' | 'A6' | 'A5';

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
};
