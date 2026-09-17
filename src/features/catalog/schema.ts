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
  name: z.string().trim().min(1, 'Nhập tên sản phẩm').max(300, 'Tối đa 300 ký tự'),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  trackingMode: z.enum(['NONE', 'LOT', 'SERIAL']),
  shelfLifeDays: z.string().trim().regex(/^\d*$/, 'Nhập số nguyên ngày, không âm'),
  defaultWarehouseId: z.string().optional(),
  description: z.string().trim().max(2000, 'Tối đa 2000 ký tự'),
  internalNote: z.string().trim().max(2000, 'Tối đa 2000 ký tự'),
  searchAliases: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  allowNegativeStock: z.boolean(),
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
  // F3 (PLAN-master-data-lot-uom) — đa ĐVT: một ĐVT phụ khai ngay trên dòng
  // ("BOX = 24 PCS" + barcode thùng). '' = không khai. SKU đã lưu: khai thêm
  // → POST /skus/:id/conversions (+ barcode theo ĐVT).
  altUom: z.string(),
  altFactor: quantitySchema.optional().or(z.literal('')),
  altBarcode: barcodeValue.optional().or(z.literal('')),
  /** ĐVT bán mặc định — '' = ĐVT cơ sở; phải là ĐVT quy đổi được. */
  salesUom: z.string(),
  /** Mã các ĐVT đã có quy đổi (SKU đã lưu) — chỉ để validate salesUom, không sửa. */
  existingConvUoms: z.array(z.string()),
});

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
    // F3 — ràng buộc ĐVT phụ, mirror 422 server (trg_conversion_not_base,
    // resolveSalesUom, trg_barcode_uom_valid)
    v.skus.forEach((row, i) => {
      const factorFilled = row.altFactor !== undefined && row.altFactor !== '';
      if (row.altUom && !factorFilled) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', i, 'altFactor'],
          message: 'Nhập hệ số quy đổi, ví dụ 24',
        });
      }
      if (row.altUom && factorFilled && new Decimal(row.altFactor!).lte(0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', i, 'altFactor'],
          message: 'Hệ số phải lớn hơn 0',
        });
      }
      if (!row.altUom && factorFilled) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', i, 'altUom'],
          message: 'Chọn ĐVT phụ cho hệ số này',
        });
      }
      if (row.altBarcode && !row.altUom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', i, 'altUom'],
          message: 'Barcode ĐVT phụ cần chọn ĐVT phụ',
        });
      }
      if (row.altUom && row.altUom === v.baseUom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', i, 'altUom'],
          message: 'ĐVT phụ phải khác ĐVT cơ sở',
        });
      }
      const sellable = ['', v.baseUom, row.altUom, ...row.existingConvUoms];
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
  altUom: '',
  altFactor: '',
  altBarcode: '',
  salesUom: '',
  existingConvUoms: [],
};

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
