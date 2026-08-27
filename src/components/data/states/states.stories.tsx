import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { DetailSkeleton, FormSkeleton, ListSkeleton } from './skeletons';

const meta: Meta = { title: 'Data/States' };
export default meta;

export const Loading: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <ListSkeleton rows={6} />
      <DetailSkeleton />
      <FormSkeleton />
    </div>
  ),
};

export const Empty: StoryObj = {
  render: () => (
    <EmptyState
      title="Chưa có khách hàng nào"
      description="Tạo khách hàng đầu tiên để bắt đầu theo dõi đơn và chăm sóc."
      action={
        <Button>
          <Plus aria-hidden /> Tạo khách hàng
        </Button>
      }
    />
  ),
};

export const Error500: StoryObj = {
  name: 'Error (5xx + traceId)',
  render: () => (
    <ErrorState
      error={new ApiError(500, 'SERVER_ERROR', 'stack', undefined, 'a1b2c3d4-trace')}
      onRetry={() => undefined}
    />
  ),
};

export const Forbidden: StoryObj = {
  name: 'Error (403)',
  render: () => <ErrorState error={new ApiError(403, 'FORBIDDEN', 'x', undefined, 't')} />,
};

export const Network: StoryObj = {
  name: 'Error (mạng)',
  render: () => (
    <ErrorState
      error={new ApiError(0, 'NETWORK_ERROR', 'x', undefined, undefined)}
      onRetry={() => undefined}
    />
  ),
};
