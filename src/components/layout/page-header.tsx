import type { ReactNode } from 'react';
import { Breadcrumb, type Crumb } from './breadcrumb';

/**
 * Đầu trang chuẩn (design system PageHeader): breadcrumb + tiêu đề + chip trạng thái + dòng phụ +
 * hành động bên phải (phụ trước, nút chính cuối kèm phím tắt).
 * Không layout shift: chiều cao cố định cho hàng tiêu đề.
 * Lớp dính 2 (token sticky-page-header = ngay dưới thanh trên) khi cuộn — tràn ra hết lề `p-5` của
 * <main> (-mx-5 px-5) để nội dung cuộn không lộ ở hai bên. z-40 để nằm trên ô dính của bảng (z-30).
 * Đầu bảng và BulkActionBar KHÔNG dính theo trang, chỉ dính trong khung cuộn riêng của bảng.
 */
export function PageHeader({
  title,
  description,
  status,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  /** Chip cạnh tiêu đề: trạng thái chứng từ, "n thay đổi chưa lưu"… */
  status?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: Crumb[];
}) {
  return (
    <header className="sticky top-sticky-page-header z-40 -mx-5 -mt-2 mb-2 space-y-1 bg-background px-5 pb-2.5 pt-2">
      <Breadcrumb items={breadcrumb} />
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-xl font-semibold leading-tight">{title}</h1>
            {status ? <div className="flex shrink-0 items-center gap-1.5">{status}</div> : null}
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
