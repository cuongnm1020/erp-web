import { useQuery } from '@tanstack/react-query';
import type { StatusTone } from '@/components/data/status-badge';
import { api, unwrap } from '@/lib/api/client';
import type { components, operations } from '@/lib/api/schema';

export type GoodsIssueListRow = components['schemas']['GoodsIssueListRowDto'];
export type GoodsIssueDetail = components['schemas']['GoodsIssueDetailDto'];
export type GoodsIssueLine = components['schemas']['GoodsIssueLineDto'];
export type GoodsIssueKind = GoodsIssueDetail['kind'];
export type GoodsIssueStatus = GoodsIssueDetail['status'];
export type GoodsIssueListParams = NonNullable<
  operations['GoodsIssueController_list']['parameters']['query']
>;

/** Phễu key (luật 3): ['wms','goods-issues', ...]. */
export const goodsIssueKeys = {
  all: ['wms', 'goods-issues'] as const,
  lists: () => [...goodsIssueKeys.all, 'list'] as const,
  list: (params: GoodsIssueListParams) => [...goodsIssueKeys.lists(), params] as const,
  detail: (id: string) => [...goodsIssueKeys.all, 'detail', id] as const,
};

/** GET /goods-issues — GDN sinh/POST tự động theo luồng pick→pack; màn này CHỈ ĐỌC. */
export function useGoodsIssues(params: GoodsIssueListParams) {
  return useQuery({
    queryKey: goodsIssueKeys.list(params),
    queryFn: () => unwrap(api.GET('/goods-issues', { params: { query: params } })),
    placeholderData: (prev) => prev,
  });
}

export function useGoodsIssue(id: string) {
  return useQuery({
    queryKey: goodsIssueKeys.detail(id),
    queryFn: () => unwrap(api.GET('/goods-issues/{id}', { params: { path: { id } } })),
  });
}

export const GDN_KIND_LABEL: Record<GoodsIssueKind, { label: string; tone: StatusTone }> = {
  SALES: { label: 'Bán hàng', tone: 'neutral' },
  TRANSFER: { label: 'Chuyển kho', tone: 'brand' },
  RETURN_TO_SUPPLIER: { label: 'Trả NCC', tone: 'warn' },
  OTHER: { label: 'Xuất khác', tone: 'neutral' },
};

type TaskStatusValue = NonNullable<GoodsIssueListRow['pickStatus']>;

/**
 * Nhãn vòng đời GDN (design GdnList) — MỘT nguồn sự thật: DocStatus của phiếu +
 * trạng thái task PICK/PACK cùng ref. Không có cột trạng thái trung gian nào ở DB.
 */
export function gdnStage(row: {
  status: GoodsIssueStatus;
  pickStatus: TaskStatusValue | null;
  packStatus: TaskStatusValue | null;
}): { label: string; tone: StatusTone } {
  if (row.status === 'POSTED') return { label: 'Đã post', tone: 'ok' };
  if (row.status === 'CANCELLED') return { label: 'Hủy', tone: 'err' };
  if (row.pickStatus === 'EXCEPTION') return { label: 'Ngoại lệ pick', tone: 'warn' };
  if (row.pickStatus === 'COMPLETED') return { label: 'Đang đóng gói', tone: 'warn' };
  if (row.pickStatus === 'IN_PROGRESS') return { label: 'Đang pick', tone: 'brand' };
  return { label: 'Chờ pick', tone: 'draft' };
}
