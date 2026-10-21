import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { normalizePhoneInput } from '../schema';
import { lineEntryKeys } from './use-line-entry';

export type SkuQuickRow = components['schemas']['SkuListRowDto'];
export type OrderStaffOption = components['schemas']['OrderStaffOptionDto'];
export type OrderTagOption = components['schemas']['TagDto'];
export type ShippingQuotePreviewBody = components['schemas']['ShippingQuotePreviewDto'];
export type CareLookupResult = components['schemas']['CareLookupResultDto'];
export type SameDayOrders = components['schemas']['SameDayOrdersDto'];

/** Phễu key của màn tạo đơn mới — con của ['crm','order-entry'] (danh mục phục vụ nhập đơn). */
const createKeys = {
  staff: () => [...lineEntryKeys.all, 'staff'] as const,
  tags: () => [...lineEntryKeys.all, 'tags'] as const,
  skuQuick: (q: string, isCombo: boolean) =>
    [...lineEntryKeys.all, 'sku-quick', { q, isCombo }] as const,
  phone: (phone: string) => [...lineEntryKeys.all, 'phone-match', phone] as const,
  careLookup: (phone: string) => [...lineEntryKeys.all, 'care-lookup', phone] as const,
  sameDay: (phone: string) => [...lineEntryKeys.all, 'same-day', phone] as const,
  quote: (b: ShippingQuotePreviewBody) => [...lineEntryKeys.all, 'quote-preview', b] as const,
};

/** GET /sales-orders/staff-options — NV xử lý / đóng hàng / chăm sóc / marketer. */
export function useOrderStaffOptions() {
  return useQuery({
    queryKey: createKeys.staff(),
    queryFn: () => unwrap(api.GET('/sales-orders/staff-options')),
    staleTime: 5 * 60_000,
  });
}

/** GET /customer-tags — danh mục thẻ dùng chung (khách + đơn). */
export function useOrderTags() {
  return useQuery({
    queryKey: createKeys.tags(),
    queryFn: () => unwrap(api.GET('/customer-tags')),
    staleTime: 5 * 60_000,
  });
}

/**
 * Ô tìm sản phẩm của giỏ hàng — GET /skus (tên, mã, barcode) kèm khả dụng theo kho. Chỉ là ô gợi
 * ý (30 dòng đầu), không phải danh sách: lọc "Còn hàng" làm trên đúng các dòng gợi ý này vì tồn
 * nằm ở wms, API không lọc được theo tồn.
 */
export function useSkuQuickSearch(q: string, isCombo: boolean) {
  return useQuery({
    queryKey: createKeys.skuQuick(q, isCombo),
    queryFn: () =>
      unwrap(
        api.GET('/skus', {
          params: { query: { q, isCombo, status: 'active', take: 30, skip: 0 } },
        }),
      ),
    enabled: q.trim() !== '',
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Khách đã có cùng SĐT (trong tầm nhìn của người bán) — GET /customers?q=<số>, lấy dòng có SĐT
 * chuẩn hoá trùng khớp. Gõ chưa đủ số thì không hỏi.
 */
export function useCustomerPhoneMatch(rawPhone: string) {
  const phone = normalizePhoneInput(rawPhone);
  return useQuery({
    queryKey: createKeys.phone(phone),
    queryFn: async () => {
      const r = await unwrap(
        api.GET('/customers', { params: { query: { q: phone, take: 5, skip: 0 } } }),
      );
      return r.items.find((c) => c.phone && normalizePhoneInput(c.phone) === phone) ?? null;
    },
    enabled: /^0\d{9,10}$/.test(phone),
    staleTime: 30_000,
  });
}

const VALID_PHONE = /^0\d{9,10}$/;

/**
 * CSKH (2026-10-21): GET /customer-care/lookup — tra SĐT trên TOÀN hệ thống (cả khách của team
 * khác / của sale) để lên đơn đúng khách, không tạo trùng. Chỉ gọi khi người dùng có quyền
 * `customer.care` (`enabled`); trả mã / tên / SĐT / địa chỉ mặc định + team CSKH đang giữ khách.
 */
export function useCareLookup(rawPhone: string, enabled: boolean) {
  const phone = normalizePhoneInput(rawPhone);
  return useQuery({
    queryKey: createKeys.careLookup(phone),
    queryFn: () => unwrap(api.GET('/customer-care/lookup', { params: { query: { phone } } })),
    enabled: enabled && VALID_PHONE.test(phone),
    staleTime: 30_000,
  });
}

/**
 * GET /sales-orders/same-day — đơn chưa hủy cùng SĐT trong hôm nay (mọi nguồn, mọi team): màn tạo
 * đơn nhắc ở thẻ khách và hỏi lại trước khi chốt (cảnh báo, không chặn). Đơn ngoài tầm nhìn chỉ có
 * trong `hiddenCount`.
 */
export function useSameDayOrders(rawPhone: string) {
  const phone = normalizePhoneInput(rawPhone);
  return useQuery({
    queryKey: createKeys.sameDay(phone),
    queryFn: () => unwrap(api.GET('/sales-orders/same-day', { params: { query: { phone } } })),
    enabled: VALID_PHONE.test(phone),
    staleTime: 10_000,
  });
}

/**
 * POST /sales-orders/shipping-quote-preview — cước hãng TRƯỚC khi có đơn (chỉ đọc). Gọi khi đủ
 * hãng + tỉnh + cân nặng; hãng lỗi / không có bảng cước thì hiện lỗi, không chặn chốt đơn.
 */
export function useShippingQuotePreview(body: ShippingQuotePreviewBody | null) {
  return useQuery({
    queryKey: createKeys.quote(body as ShippingQuotePreviewBody),
    queryFn: () =>
      unwrap(
        api.POST('/sales-orders/shipping-quote-preview', {
          body: body as ShippingQuotePreviewBody,
        }),
      ),
    enabled: body !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** POST /sales-orders/{id}/attachments — tải từng tệp sau khi đơn đã chốt (multipart 'file'). */
export function useUploadOrderAttachment() {
  return useMutation({
    mutationFn: ({ orderId, file }: { orderId: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      return unwrap(
        api.POST('/sales-orders/{id}/attachments', {
          params: { path: { id: orderId } },
          body: fd as never,
          // Giữ nguyên FormData + bỏ Content-Type json để browser tự đặt multipart boundary
          bodySerializer: (b: unknown) => b as FormData,
          headers: { 'Content-Type': null },
        }),
      );
    },
  });
}
