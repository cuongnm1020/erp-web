import { useMutation, useQuery } from '@tanstack/react-query';
import type { EntityOption, EntitySearchResult } from '@/components/data/form';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type SkuDetail = components['schemas']['SkuDetailDto'];
export type StockRow = components['schemas']['StockRowDto'];
export type ResolvedPrice = components['schemas']['ResolvedPriceDto'];
export type Team = components['schemas']['TeamDto'];

/** Phễu key riêng cho dữ liệu nhập dòng hàng — không đụng phễu ['crm','orders']. */
export const lineEntryKeys = {
  all: ['crm', 'order-entry'] as const,
  customerSearch: (q: string) => [...lineEntryKeys.all, 'customer-search', q] as const,
  skuSearch: (q: string) => [...lineEntryKeys.all, 'sku-search', q] as const,
  sku: (id: string) => [...lineEntryKeys.all, 'sku', id] as const,
  stock: (skuCode: string) => [...lineEntryKeys.all, 'stock', skuCode] as const,
  price: (p: LinePriceParams) => [...lineEntryKeys.all, 'price', p] as const,
  teams: () => [...lineEntryKeys.all, 'teams'] as const,
};

export interface LinePriceParams {
  skuId: string;
  uomId: string;
  qty: string;
  customerId: string;
  channel: 'DIRECT' | 'MARKETPLACE' | 'WEBSITE' | 'POS';
}

/**
 * GET /prices/resolve — XEM TRƯỚC giá niêm yết + trần CK cho một dòng (server resolve qua
 * core.resolve_price; giá cuối vẫn do POST /sales-orders snapshot). 404 = khách ngoài scope,
 * 422 PRICE_NOT_FOUND = chưa có bảng giá phủ — hiện '—', không chặn nhập.
 */
export function useLinePrice(p: LinePriceParams) {
  const enabled = p.skuId !== '' && p.uomId !== '' && p.customerId !== '' && /^\d/.test(p.qty);
  return useQuery({
    queryKey: lineEntryKeys.price(p),
    queryFn: () => unwrap(api.GET('/prices/resolve', { params: { query: p } })),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** GET /teams — danh bạ team cho select `teamId` khi tạo nhanh khách hàng. */
export function useTeams() {
  return useQuery({
    queryKey: lineEntryKeys.teams(),
    queryFn: () => unwrap(api.GET('/teams')),
    staleTime: 300_000,
  });
}

/** GET /customers/{id} — chỉ để hiện tên khách khi vào form bằng ?customerId=. */
export function useCustomerBrief(id: string) {
  return useQuery({
    queryKey: [...lineEntryKeys.all, 'customer', id] as const,
    queryFn: () => unwrap(api.GET('/customers/{id}', { params: { path: { id } } })),
    enabled: id !== '',
    staleTime: 60_000,
  });
}

export type QuickCustomerBody = components['schemas']['CreateCustomerDto'];

/**
 * POST /customers — tạo nhanh khách ngay trong form lên đơn (sale đang chat, khách chưa có
 * trong hệ thống). Member tự thành owner phía server; team phải thuộc scope người tạo.
 */
export function useQuickCreateCustomer() {
  return useMutation({
    mutationFn: (body: QuickCustomerBody) => unwrap(api.POST('/customers', { body })),
  });
}

/**
 * Tìm khách cho EntityPicker — GET /customers (đã scope theo người bán).
 * Không import từ features/customers (luật 12: feature không import chéo feature).
 */
export function useCustomerSearch(q: string): EntitySearchResult {
  const query = useQuery({
    queryKey: lineEntryKeys.customerSearch(q),
    queryFn: () =>
      unwrap(
        api.GET('/customers', { params: { query: { q: q || undefined, take: 20, skip: 0 } } }),
      ),
    staleTime: 30_000,
  });
  const options: EntityOption[] | undefined = query.data?.items.map((c) => ({
    id: c.id,
    label: c.name,
    hint: c.phone ? `${c.code} · ${c.phone}` : c.code,
  }));
  return { options, isPending: query.isPending, error: query.error };
}

/**
 * Tìm SKU cho EntityPicker qua GET /products (q ăn tên/mã product, mã/tên SKU và barcode).
 * Mỗi SKU active là một option — id là SKU id, đúng thứ CreateOrderLineDto cần.
 */
export function useSkuSearch(q: string): EntitySearchResult {
  const query = useQuery({
    queryKey: lineEntryKeys.skuSearch(q),
    queryFn: () =>
      unwrap(api.GET('/products', { params: { query: { q: q || undefined, take: 20, skip: 0 } } })),
    staleTime: 30_000,
  });
  const options: EntityOption[] | undefined = query.data?.items.flatMap((p) =>
    p.skus.map((s) => ({ id: s.id, label: s.name, hint: `${s.code} · ${p.name}` })),
  );
  return { options, isPending: query.isPending, error: query.error };
}

/** GET /skus/{id} — nguồn cho dropdown ĐVT: base UoM + các quy đổi (1 uom = factor × cơ sở). */
export function useSkuDetail(id: string) {
  return useQuery({
    queryKey: lineEntryKeys.sku(id),
    queryFn: () => unwrap(api.GET('/skus/{id}', { params: { path: { id } } })),
    enabled: id !== '',
    staleTime: 60_000,
  });
}

/** Khả dụng theo SKU (ĐVT cơ sở) — GET /stock?q=<mã SKU>, lấy đúng dòng khớp mã. */
export function useSkuAvailability(skuCode: string) {
  return useQuery({
    queryKey: lineEntryKeys.stock(skuCode),
    queryFn: async () => {
      const r = await unwrap(
        api.GET('/stock', { params: { query: { q: skuCode, take: 10, skip: 0 } } }),
      );
      return r.items.find((i) => i.skuCode === skuCode) ?? null;
    },
    enabled: skuCode !== '',
    staleTime: 15_000,
  });
}
