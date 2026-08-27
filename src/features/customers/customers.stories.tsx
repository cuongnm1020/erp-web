import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { handlers, scenario } from '@/test/msw/handlers';
import { CustomerListGate } from './components/customer-list-gate';

/** Màn gate FE-0 qua MSW — 4 trạng thái bằng handler, không sửa component. */
const meta: Meta<typeof CustomerListGate> = {
  title: 'Features/Customers/ListGate',
  component: CustomerListGate,
  parameters: { nextjs: { navigation: { pathname: '/kernel-gate' } } },
};
export default meta;

export const Success: StoryObj = { parameters: { msw: { handlers } } };
export const Loading: StoryObj = { parameters: { msw: { handlers: [scenario.customersSlow] } } };
export const Empty: StoryObj = { parameters: { msw: { handlers: [scenario.customersEmpty] } } };
export const Error: StoryObj = { parameters: { msw: { handlers: [scenario.customersError] } } };
export const Forbidden: StoryObj = {
  parameters: { msw: { handlers: [scenario.customersForbidden] } },
};
