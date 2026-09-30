import Decimal from 'decimal.js';
import { z } from 'zod';
import { codeSchema, moneySchema, quantitySchema } from '@/lib/shared';

/**
 * Khớp CreateProductDto của apps/api (luật 11 — không chặt/lỏng hơn DTO).
 * - code bỏ trống → backend tự sinh `{categoryCode|SP}-{seq}`.
 * - shelfLifeDays nhập dạng chuỗi số (input text/numeric), submit mới đổi sang number
 *   (Number.parseInt — số nguyên ngày, không phải decimal); rỗng = không gửi.
 * - searchAliases nhập MỘT ô, phân tách bằng dấu phẩy — submit mới tách thành mảng
 *   (parseAliases); backend nhận string[].
 */
export const createProductSchema = z.object({
  code: codeSchema.optional().or(z.literal('')),
  /** Tên thương mại — nhãn trên UI là "Tên thương mại", field API vẫn là `name`. */
  name: z.string().trim().min(1, 'Nhập tên thương mại').max(300, 'Tối đa 300 ký tự'),
  /** Tên in trên hóa đơn — '' = dùng tên thương mại (gửi null để xóa khi sửa). */
  invoiceName: z.string().trim().max(300, 'Tối đa 300 ký tự'),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  trackingMode: z.enum(['NONE', 'LOT', 'SERIAL']),
  shelfLifeDays: z.string().trim().regex(/^\d*$/, 'Nhập số nguyên ngày, không âm'),
  defaultWarehouseId: z.string().optional(),
  description: z.string().trim().max(2000, 'Tối đa 2000 ký tự'),
  internalNote: z.string().trim().max(2000, 'Tối đa 2000 ký tự'),
  searchAliases: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  allowNegativeStock: z.boolean(),
  /**
   * Mức tồn kho cảnh báo nhập hàng — Decimal(18,6) chuỗi theo ĐVT cơ sở (luật 10), '' = không
   * cảnh báo. Màn /wms/reorder-points so tồn thực + tốc độ bán 1–2 ngày với ngưỡng này.
   */
  reorderLevel: quantitySchema.optional().or(z.literal('')),
});

export type CreateProductValues = z.infer<typeof createProductSchema>;

/**
 * Khớp UpdateProductDto — code đổi ĐƯỢC (server chặn 409 khi đã phát sinh chứng từ);
 * thêm isActive (Đang bán / Ngừng bán). `version` không nằm trong form — lấy từ
 * ProductDetailDto lúc submit (optimistic locking).
 */
export const updateProductSchema = createProductSchema.extend({
  isActive: z.boolean(),
});

export type UpdateProductValues = z.infer<typeof updateProductSchema>;

/** "thuốc trĩ, cheshaland" → ['thuốc trĩ','cheshaland'] — bỏ phần tử rỗng, không trùng. */
export function parseAliases(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Một dòng biến thể trên form sản phẩm (design/Products/ProductForm).
 * - skuId rỗng = dòng MỚI (sẽ POST /products/:id/skus); có = SKU sẵn có (PATCH khi đổi).
 * - barcode: một barcode lẻ, khớp BarcodeDto ([A-Za-z0-9-]{4,64}); SKU sẵn có mà thêm
 *   barcode mới → POST /skus/:id/barcodes.
 * - existingBarcode: barcode đầu tiên đã có (chỉ đọc — quản lý đầy đủ ở màn chi tiết).
 * - purchasePrice/salePrice: string decimal (luật 10). salePrice ghi vào BẢNG GIÁ MẶC ĐỊNH.
 * - weightG: nhập theo GRAM cho dễ gõ — API nhận weightKg, quy đổi lúc submit (decimal.js).
 * - openingQty: tồn đầu kỳ, CHỈ dòng mới (tồn là ledger — đã có SKU thì nhập/xuất qua chứng từ).
 */
const barcodeValue = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{4,64}$/, 'Barcode 4–64 ký tự chữ/số/gạch nối');

export const skuRowSchema = z.object({
  skuId: z.string(),
  /** Ô mã SKU đang ẩn trên form — bỏ trống, submit tự sinh `{mã sản phẩm}-{stt}`. */
  code: codeSchema.optional().or(z.literal('')),
  /** Sản phẩm có biến thể: bắt buộc (kiểm ở superRefine). Sản phẩm đơn: ẩn, server lấy tên sản phẩm. */
  name: z.string().trim().max(300, 'Tối đa 300 ký tự'),
  barcode: barcodeValue.optional().or(z.literal('')),
  isActive: z.boolean(),
  existingBarcode: z.string(),
  purchasePrice: moneySchema.optional().or(z.literal('')),
  salePrice: moneySchema.optional().or(z.literal('')),
  weightG: z
    .string()
    .trim()
    .regex(/^\d{1,9}(\.\d{1,4})?$/, 'Trọng lượng gram không hợp lệ')
    .optional()
    .or(z.literal('')),
  openingQty: quantitySchema.optional().or(z.literal('')),
  // PLAN-packaging-hierarchy §12 (2026-09-22) — đóng gói HAI cấp thùng trên ĐVT cơ sở, nhập theo
  // chuỗi: "1 thùng = ? ĐVT cơ sở" (CARTON) và "1 pallet = ? thùng" (PALLET). Gửi API vẫn là
  // `UomConversion.factor` VỀ ĐVT CƠ SỞ (pallet = thùng × pallet). '' = không khai. SKU đã lưu:
  // khai thêm → POST /skus/:id/conversions (+ barcode theo ĐVT).
  cartonUom: z.string(),
  cartonPer: quantitySchema.optional().or(z.literal('')),
  cartonBarcode: barcodeValue.optional().or(z.literal('')),
  palletUom: z.string(),
  palletPer: quantitySchema.optional().or(z.literal('')),
  palletBarcode: barcodeValue.optional().or(z.literal('')),
  /** ĐVT bán mặc định — '' = ĐVT cơ sở; phải là ĐVT quy đổi được. */
  salesUom: z.string(),
  /** Mã các ĐVT đã có quy đổi (SKU đã lưu) — chỉ để validate salesUom, không sửa. */
  existingConvUoms: z.array(z.string()),
  /** SKU đã lưu: hệ số cấp thùng ĐÃ có ('' = chưa khai thùng) — để khai thêm pallet tính được factor. */
  existingCartonFactor: z.string(),
});

/** Số nguyên dương (số lượng trong thùng / số thùng trong pallet): factor cấp đóng gói luôn tròn. */
const wholeAtLeast = (s: string, min: number) => {
  const d = new Decimal(s);
  return d.isInteger() && d.gte(min);
};

export const productFormSchema = createProductSchema
  .extend({
    baseUom: z.string().min(1, 'Chọn ĐVT cơ bản'),
    /**
     * false = sản phẩm đơn: đúng MỘT SKU thừa kế mã + tên sản phẩm (API tự điền khi bỏ trống).
     * true = nhiều biến thể nhập tay, mỗi dòng phải có tên.
     */
    hasVariants: z.boolean(),
    skus: z.array(skuRowSchema).min(1, 'Sản phẩm cần ít nhất một biến thể / SKU'),
  })
  .superRefine((v, ctx) => {
    if (v.hasVariants) {
      v.skus.forEach((row, i) => {
        if (!row.name) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['skus', i, 'name'],
            message: 'Nhập tên biến thể',
          });
        }
      });
    }
    // Ràng buộc tồn đầu kỳ — khớp luật server (422): cần giá nhập + kho mặc định
    v.skus.forEach((row, i) => {
      const qty = row.openingQty && !new Decimal(row.openingQty).isZero();
      if (!qty) return;
      if (!row.purchasePrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', i, 'purchasePrice'],
          message: 'Nhập giá nhập để ghi giá vốn cho tồn đầu kỳ',
        });
      }
      if (!v.defaultWarehouseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['defaultWarehouseId'],
          message: 'Chọn kho mặc định để ghi tồn đầu kỳ',
        });
      }
      if (v.trackingMode !== 'NONE') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', i, 'openingQty'],
          message: 'Hàng theo lô/serial: nhập tồn đầu kỳ qua Import (cần số lô/HSD)',
        });
      }
    });
    // Đóng gói hai cấp — mirror 422 server (trg_conversion_not_base, resolveSalesUom,
    // trg_barcode_uom_valid) + luật §12: hệ số nguyên, pallet chia hết cho thùng (nhập theo chuỗi
    // nên luôn chia hết), phải có thùng mới có pallet.
    v.skus.forEach((row, i) => {
      const issue = (field: keyof typeof row, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['skus', i, field], message });
      const cartonFilled = row.cartonPer !== undefined && row.cartonPer !== '';
      if (row.cartonUom && !cartonFilled) {
        issue('cartonPer', 'Nhập số lượng trong một thùng, ví dụ 24');
      }
      if (row.cartonUom && cartonFilled && !wholeAtLeast(row.cartonPer!, 1)) {
        issue('cartonPer', 'Số lượng trong thùng phải là số nguyên lớn hơn 0');
      }
      if (!row.cartonUom && cartonFilled) issue('cartonUom', 'Chọn ĐVT thùng cho số lượng này');
      if (row.cartonBarcode && !row.cartonUom)
        issue('cartonUom', 'Barcode thùng cần chọn ĐVT thùng');
      if (row.cartonUom && row.cartonUom === v.baseUom) {
        issue('cartonUom', 'ĐVT thùng phải khác ĐVT cơ sở');
      }

      const hasCarton = Boolean(row.cartonUom) || row.existingCartonFactor !== '';
      const palletFilled = row.palletPer !== undefined && row.palletPer !== '';
      if (row.palletUom && !hasCarton) {
        issue('palletUom', 'Khai cấp thùng trước rồi mới khai pallet');
      }
      if (row.palletUom && !palletFilled) {
        issue('palletPer', 'Nhập số thùng trong một pallet, ví dụ 10');
      }
      if (row.palletUom && palletFilled && !wholeAtLeast(row.palletPer!, 2)) {
        issue('palletPer', 'Số thùng trong pallet phải là số nguyên từ 2 trở lên');
      }
      if (!row.palletUom && palletFilled) issue('palletUom', 'Chọn ĐVT pallet cho số thùng này');
      if (row.palletBarcode && !row.palletUom) {
        issue('palletUom', 'Barcode pallet cần chọn ĐVT pallet');
      }
      if (row.palletUom && (row.palletUom === v.baseUom || row.palletUom === row.cartonUom)) {
        issue('palletUom', 'ĐVT pallet phải khác ĐVT cơ sở và ĐVT thùng');
      }

      const sellable = ['', v.baseUom, row.cartonUom, row.palletUom, ...row.existingConvUoms];
      if (!sellable.includes(row.salesUom)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', i, 'salesUom'],
          message: 'ĐVT bán phải là ĐVT cơ sở hoặc ĐVT đã có quy đổi',
        });
      }
    });
  });

export type SkuRowValues = z.infer<typeof skuRowSchema>;
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const EMPTY_SKU_ROW: SkuRowValues = {
  skuId: '',
  code: '',
  name: '',
  barcode: '',
  isActive: true,
  existingBarcode: '',
  purchasePrice: '',
  salePrice: '',
  weightG: '',
  openingQty: '',
  cartonUom: '',
  cartonPer: '',
  cartonBarcode: '',
  palletUom: '',
  palletPer: '',
  palletBarcode: '',
  salesUom: '',
  existingConvUoms: [],
  existingCartonFactor: '',
};

/** Loại thùng gửi API cho hai cấp đóng gói của form (mã trong `/container-types`). */
export const CARTON_TYPE = 'CARTON';
export const PALLET_TYPE = 'PALLET';

/**
 * Hệ số cấp thùng ĐÃ có của SKU đã lưu: quyết định §12 tối đa hai cấp thùng → quy đổi có
 * `containerTypeId` với factor NHỎ nhất là thùng (lớn hơn là pallet). '' = chưa khai thùng.
 */
export function existingCartonFactorOf(
  conversions: ReadonlyArray<{ factor: string; containerTypeId: string | null }>,
): string {
  const containers = conversions
    .filter((c) => c.containerTypeId !== null)
    .sort((a, b) => new Decimal(a.factor).comparedTo(new Decimal(b.factor)));
  return containers[0]?.factor ?? '';
}

/**
 * Quy đổi gửi API từ khối đóng gói của một dòng SKU — thùng TRƯỚC pallet (server đòi thùng có
 * trước để kiểm chia hết). Factor về ĐVT cơ sở: thùng = `cartonPer`; pallet = thùng × `palletPer`,
 * lấy hệ số thùng vừa nhập hoặc hệ số thùng đã có của SKU đã lưu.
 */
export function packagingConversions(
  row: SkuRowValues,
): Array<{ uom: string; factor: string; containerType: string }> {
  const out: Array<{ uom: string; factor: string; containerType: string }> = [];
  const cartonFactor = row.cartonUom && row.cartonPer ? row.cartonPer : row.existingCartonFactor;
  if (row.cartonUom && row.cartonPer) {
    out.push({ uom: row.cartonUom, factor: row.cartonPer, containerType: CARTON_TYPE });
  }
  if (row.palletUom && row.palletPer && cartonFactor) {
    out.push({
      uom: row.palletUom,
      factor: new Decimal(cartonFactor).mul(row.palletPer).toString(),
      containerType: PALLET_TYPE,
    });
  }
  return out;
}

/** Barcode theo ĐVT thùng / pallet của dòng — chỉ khi ĐVT tương ứng được khai. */
export function packagingBarcodes(row: SkuRowValues): Array<{ code: string; uom: string }> {
  return [
    ...(row.cartonBarcode && row.cartonUom
      ? [{ code: row.cartonBarcode, uom: row.cartonUom }]
      : []),
    ...(row.palletBarcode && row.palletUom
      ? [{ code: row.palletBarcode, uom: row.palletUom }]
      : []),
  ];
}

/** Gram (form) → kg (API, Decimal(12,4) chuỗi) — chỉ ở lớp hiển thị/submit (luật 10). */
export function gramsToKg(g: string): string {
  return new Decimal(g).div(1000).toDecimalPlaces(4).toString();
}

/** Kg (API) → gram (form). */
export function kgToGrams(kg: string): string {
  return new Decimal(kg).mul(1000).toDecimalPlaces(1).toString();
}

// ── Combo sản phẩm (2026-09-18) ─────────────────────────────────────────────

/**
 * Một dòng thành phần combo — khớp ComboComponentInputDto (skuId + qty); mã / tên / ĐVT /
 * khả dụng chỉ để hiển thị (lấy từ option đã chọn hoặc từ ComboDetailDto khi sửa).
 */
export const comboComponentRowSchema = z.object({
  skuId: z.string().refine((v) => v !== '', 'Chọn SKU thành phần'),
  skuCode: z.string(),
  skuName: z.string(),
  baseUomCode: z.string(),
  /** Decimal(18,6) chuỗi — tồn khả dụng thành phần lúc chọn; '' = chưa biết. */
  available: z.string(),
  qty: quantitySchema.refine((v) => !new Decimal(v).isZero(), 'Định mức phải lớn hơn 0'),
});

/**
 * Khớp CreateComboDto / UpdateComboDto (luật 11). `version` không nằm trong form — lấy từ
 * ComboDetailDto lúc submit. Giá bán ghi vào BẢNG GIÁ MẶC ĐỊNH (giá không nằm trên SKU).
 */
export const comboFormSchema = z
  .object({
    code: codeSchema.optional().or(z.literal('')),
    name: z.string().trim().min(1, 'Nhập tên combo').max(300, 'Tối đa 300 ký tự'),
    categoryId: z.string().optional(),
    brandId: z.string().optional(),
    description: z.string().trim().max(2000, 'Tối đa 2000 ký tự'),
    searchAliases: z.string().trim().max(500, 'Tối đa 500 ký tự'),
    salePrice: moneySchema.optional().or(z.literal('')),
    isActive: z.boolean(),
    components: z.array(comboComponentRowSchema).min(1, 'Combo cần ít nhất một thành phần'),
  })
  .superRefine((v, ctx) => {
    // Server chặn 422 COMBO_COMPONENT_INVALID khi trùng SKU — báo ngay trên dòng sau.
    const seen = new Set<string>();
    v.components.forEach((row, i) => {
      if (!row.skuId) return;
      if (seen.has(row.skuId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['components', i, 'skuId'],
          message: 'SKU này đã có ở dòng trên',
        });
      }
      seen.add(row.skuId);
    });
  });

export type ComboComponentRowValues = z.infer<typeof comboComponentRowSchema>;
export type ComboFormValues = z.infer<typeof comboFormSchema>;

export const EMPTY_COMBO_ROW: ComboComponentRowValues = {
  skuId: '',
  skuCode: '',
  skuName: '',
  baseUomCode: '',
  available: '',
  qty: '1',
};

/**
 * Số combo còn bán được từ các dòng thành phần = min floor(khả dụng / định mức); dòng chưa
 * biết tồn ('') hoặc định mức sai → null (không đoán). Cùng công thức với server (ComboService).
 */
export function comboAvailableFromRows(
  rows: readonly { qty: string; available: string }[],
): string | null {
  if (rows.length === 0) return null;
  let min: Decimal | null = null;
  for (const r of rows) {
    if (r.available === '' || !/^-?\d/.test(r.available) || !/^\d/.test(r.qty)) return null;
    const qty = new Decimal(r.qty);
    if (qty.lessThanOrEqualTo(0)) return null;
    const available = new Decimal(r.available);
    const n = available.lessThanOrEqualTo(0) ? new Decimal(0) : available.div(qty).floor();
    if (min === null || n.lessThan(min)) min = n;
  }
  return min === null ? null : min.toString();
}
