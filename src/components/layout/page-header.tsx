import type { ReactNode } from 'react';
import { Breadcrumb, type Crumb } from './breadcrumb';

/**
 * Đầu trang chuẩn: breadcrumb + tiêu đề + mô tả + hành động chính (bên phải).
 * Không layout shift: chiều cao cố định cho hàng tiêu đề.
 * Redesign 2026-10-17: dính ngay dưới thanh trên (top-12) khi cuộn — tràn ra hết lề `p-5` của
 * <main> (-mx-5 px-5) để nội dung cuộn không lộ ở hai bên. z-40 để nằm trên ô dính của bảng (z-30).
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: Crumb[];
}) {
  return (
    <header className="sticky top-12 z-40 -mx-5 -mt-2 mb-2 space-y-1 bg-background px-5 pb-2.5 pt-2">
      <Breadcrumb items={breadcrumb} />
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold leading-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
