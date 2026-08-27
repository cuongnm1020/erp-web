import type { ReactNode } from 'react';
import { Breadcrumb, type Crumb } from './breadcrumb';

/**
 * Đầu trang chuẩn: breadcrumb + tiêu đề + mô tả + hành động chính (bên phải).
 * Không layout shift: chiều cao cố định cho hàng tiêu đề.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: Crumb[];
}) {
  return (
    <header className="mb-4 space-y-2">
      <Breadcrumb items={breadcrumb} />
      <div className="flex min-h-9 items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold leading-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
