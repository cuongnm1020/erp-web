import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type ExportRequest = components['schemas']['ExportRequestDto'];
export type ExportRequestStatus = ExportRequest['status'];
export type ExcelLog = components['schemas']['ExcelLogDto'];
export type ExcelAction = ExcelLog['action'];

export interface ExportRequestListParams {
  status?: ExportRequestStatus;
  mine?: boolean;
  take: number;
  skip: number;
}

export interface ExcelLogListParams {
  kind?: 'export' | 'import';
  action?: ExcelAction;
  userId?: string;
  from?: string;
  to?: string;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3). */
export const exportRequestKeys = {
  all: ['admin', 'export-requests'] as const,
  list: (p: ExportRequestListParams) => ['admin', 'export-requests', 'list', p] as const,
  pending: () => ['admin', 'export-requests', 'pending-count'] as const,
  logs: (p: ExcelLogListParams) => ['admin', 'excel-logs', 'list', p] as const,
};

/** GET /export-requests — người duyệt thấy mọi yêu cầu (trừ `mine`), người khác chỉ của mình. */
export function useExportRequests(params: ExportRequestListParams) {
  return useQuery({
    queryKey: exportRequestKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/export-requests', {
          params: {
            query: {
              status: params.status,
              mine: params.mine ? 'true' : undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Số yêu cầu chờ duyệt + SMTP đã cấu hình chưa (chỉ người có export.approve). */
export function useExportPendingCount(enabled: boolean) {
  return useQuery({
    queryKey: exportRequestKeys.pending(),
    queryFn: () => unwrap(api.GET('/export-requests/pending-count')),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useExcelLogs(params: ExcelLogListParams) {
  return useQuery({
    queryKey: exportRequestKeys.logs(params),
    queryFn: () =>
      unwrap(
        api.GET('/excel-logs', {
          params: {
            query: {
              kind: params.kind,
              action: params.action,
              userId: params.userId,
              from: params.from,
              to: params.to,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: exportRequestKeys.all });
    void qc.invalidateQueries({ queryKey: ['admin', 'excel-logs'] });
  };
}

export function useApproveExportRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/export-requests/{id}/approve', { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useRejectExportRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        api.POST('/export-requests/{id}/reject', {
          params: { path: { id } },
          body: { reason },
        }),
      ),
    onSettled: invalidate,
  });
}

export function useResendExportRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/export-requests/{id}/resend', { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

/** Link xem trước file của yêu cầu (người duyệt; server ghi nhật ký lượt tải). */
export const exportRequestFileHref = (id: string) =>
  `/api/export-requests/${encodeURIComponent(id)}/file`;

// ── Luồng xuất của mọi màn (provider) ─────────────────────────────

export interface ExportUpload {
  blob: Blob;
  fileName: string;
  email: string;
  resource: string;
  title: string;
  rowCount?: number;
  filters?: Record<string, unknown>;
}

/** POST /export-requests (multipart) — file trình duyệt tạo + email, chờ duyệt. */
export function useCreateExportRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (u: ExportUpload) => {
      const fd = new FormData();
      // File (không phải Blob + tên) — giữ tên file ở mọi môi trường FormData.
      fd.append('file', new File([u.blob], u.fileName, { type: u.blob.type }));
      fd.append('email', u.email);
      fd.append('resource', u.resource);
      fd.append('title', u.title);
      if (u.rowCount !== undefined) fd.append('rowCount', String(u.rowCount));
      if (u.filters) fd.append('filters', JSON.stringify(u.filters).slice(0, 4000));
      return unwrap(
        api.POST('/export-requests', {
          body: fd as never,
          bodySerializer: (b: unknown) => b as FormData,
          // Bỏ Content-Type mặc định (json) để browser tự đặt multipart boundary.
          headers: { 'Content-Type': null },
        }),
      );
    },
    onSuccess: invalidate,
  });
}

/** POST /excel-logs — báo một lần tải trực tiếp (người có export.direct). */
export function useLogDirectExport() {
  return useMutation({
    mutationFn: (b: {
      resource: string;
      title: string;
      fileName: string;
      fileSize?: number;
      rowCount?: number;
      filters?: Record<string, unknown>;
    }) =>
      unwrap(
        api.POST('/excel-logs', {
          body: {
            resource: b.resource,
            title: b.title.slice(0, 120),
            fileName: b.fileName.slice(0, 200),
            fileSize: b.fileSize,
            rowCount: b.rowCount,
            filters: b.filters ? JSON.stringify(b.filters).slice(0, 4000) : undefined,
          },
        }),
      ),
  });
}

/** Gửi yêu cầu xuất cho file do server tạo (hàm `requestByEmail` của màn). */
export function useServerExportRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ run, email }: { run: (email: string) => Promise<unknown>; email: string }) =>
      run(email),
    onSuccess: invalidate,
  });
}
