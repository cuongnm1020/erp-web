import Decimal from 'decimal.js';
import { formatQuantity } from '@/lib/format';
import { quantitySchema } from '@/lib/shared';
import type { CreateReturnBody, ReturnableLine } from './api/use-returns';

/**
 * Logic dòng phiếu nhập hàng hoàn dùng chung cho màn web (/wms/returns/new) và màn quét kiện trên
 * PDA / điện thoại (/pda/returns). SL tính bằng decimal.js (luật 10).
 */
export const RETURN_REASONS = [
  'Khách trả hàng',
  'ĐVVC hoàn (giao không thành)',
  'Sai hàng / thiếu hàng',
  'Hàng lỗi',
] as const;

export interface ReturnLineInput {
  restock: string;
  scrap: string;
}

export const qtyOk = (v: string) => v === '' || quantitySchema.safeParse(v).success;
export const dec = (v: string) =>
  v && quantitySchema.safeParse(v).success ? new Decimal(v) : null;

/** SL đã nhập cho dòng (nhập lại + hỏng). */
export function usedQty(input: ReturnLineInput | undefined): Decimal {
  return (dec(input?.restock ?? '') ?? new Decimal(0)).add(dec(input?.scrap ?? '') ?? 0);
}

/** Lỗi của dòng: SL sai định dạng hoặc vượt phần còn hoàn được. */
export function returnLineError(
  l: ReturnableLine,
  input: ReturnLineInput | undefined,
): string | null {
  if (!input) return null;
  if (!qtyOk(input.restock) || !qtyOk(input.scrap)) return 'SL không hợp lệ';
  if (usedQty(input).gt(l.qtyReturnable)) return `Tối đa ${formatQuantity(l.qtyReturnable)}`;
  return null;
}

/** Dòng gửi lên POST /return-receipts — mỗi dòng đơn tối đa một dòng RESTOCK + một dòng SCRAP. */
export function returnBodyLines(
  lines: readonly ReturnableLine[],
  inputs: Record<string, ReturnLineInput>,
): CreateReturnBody['lines'] {
  return lines.flatMap((l) => {
    const i = inputs[l.orderLineId];
    const out: CreateReturnBody['lines'] = [];
    if (i && dec(i.restock)?.gt(0)) out.push({ orderLineId: l.orderLineId, qty: i.restock });
    if (i && dec(i.scrap)?.gt(0)) {
      out.push({ orderLineId: l.orderLineId, qty: i.scrap, disposition: 'SCRAP' });
    }
    return out;
  });
}
