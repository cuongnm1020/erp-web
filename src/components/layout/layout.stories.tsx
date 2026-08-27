import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import { EmptyState } from '../data/states/empty-state';
import { ErrorState } from '../data/states/error-state';
import { ListSkeleton } from '../data/states/skeletons';
import { AppShell } from './app-shell';
import { PageHeader } from './page-header';

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: { user: { code: 'admin', roles: ['ADMIN'] }, onLogout: () => undefined },
};
export default meta;

const Header = () => (
  <PageHeader
    title="Khách hàng"
    description="17.234 khách hàng"
    actions={
      <Button>
        <Plus aria-hidden /> Tạo khách hàng
      </Button>
    }
  />
);

export const Success: StoryObj<typeof AppShell> = {
  render: (args) => (
    <AppShell {...args}>
      <Header />
      <div className="rounded-md border p-6 text-sm text-muted-foreground">Nội dung màn hình</div>
    </AppShell>
  ),
};

export const Loading: StoryObj<typeof AppShell> = {
  render: (args) => (
    <AppShell {...args} user={undefined}>
      <Header />
      <ListSkeleton rows={8} />
    </AppShell>
  ),
};

export const Empty: StoryObj<typeof AppShell> = {
  render: (args) => (
    <AppShell {...args}>
      <Header />
      <EmptyState title="Chưa có khách hàng nào" action={<Button>Tạo khách hàng</Button>} />
    </AppShell>
  ),
};

export const Error: StoryObj<typeof AppShell> = {
  render: (args) => (
    <AppShell {...args}>
      <Header />
      <ErrorState
        error={new ApiError(500, 'SERVER_ERROR', 'x', undefined, 'trace-shell')}
        onRetry={() => undefined}
      />
    </AppShell>
  ),
};

/** Đổi toolbar "me" sang `sale` để thấy sidebar ẩn Quản trị / Báo cáo. */
export const SaleAbility: StoryObj<typeof AppShell> = {
  name: 'Sidebar theo quyền (chọn me=sale ở toolbar)',
  globals: { me: 'sale' },
  render: (args) => (
    <AppShell {...args} user={{ code: 'sale.hn.1', roles: ['SALES_MEMBER'] }}>
      <Header />
    </AppShell>
  ),
};
