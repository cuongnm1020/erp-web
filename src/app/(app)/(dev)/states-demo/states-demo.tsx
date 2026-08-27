'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/errors';

type State = 'loading' | 'empty' | 'error' | 'forbidden' | 'success';
const STATES: State[] = ['loading', 'empty', 'error', 'forbidden', 'success'];

export function StatesDemo() {
  const [state, setState] = useState<State>('loading');
  return (
    <>
      <PageHeader
        title="Demo trạng thái"
        description="Công tắc 4 trạng thái chuẩn + toast"
        breadcrumb={[{ label: 'Dev' }, { label: 'Trạng thái' }]}
        actions={
          <Button
            variant="outline"
            onClick={() => toast.success('Đã lưu thay đổi', { description: 'Ví dụ toast' })}
          >
            Toast
          </Button>
        }
      />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Trạng thái">
        {STATES.map((s) => (
          <Button
            key={s}
            role="tab"
            aria-selected={state === s}
            size="sm"
            variant={state === s ? 'default' : 'outline'}
            onClick={() => setState(s)}
          >
            {s}
          </Button>
        ))}
      </div>
      {state === 'loading' ? <ListSkeleton rows={6} /> : null}
      {state === 'empty' ? (
        <EmptyState
          title="Chưa có khách hàng nào"
          description="Tạo khách hàng đầu tiên để bắt đầu theo dõi đơn và chăm sóc."
          action={
            <Button>
              <Plus aria-hidden /> Tạo khách hàng
            </Button>
          }
        />
      ) : null}
      {state === 'error' ? (
        <ErrorState
          error={new ApiError(500, 'SERVER_ERROR', 'boom', undefined, 'trace-demo-123')}
          onRetry={() => setState('loading')}
        />
      ) : null}
      {state === 'forbidden' ? (
        <ErrorState error={new ApiError(403, 'FORBIDDEN', 'x', undefined, 't')} />
      ) : null}
      {state === 'success' ? (
        <div className="rounded-lg border p-4 text-sm">Dữ liệu đã về. Bảng thật ở FE-0-07.</div>
      ) : null}
    </>
  );
}
