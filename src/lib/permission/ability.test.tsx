import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildAbility, parsePermission, toSubject } from './ability';
import { AbilityProvider, Can, useAbility } from './ability-provider';

const SALE = {
  permissions: ['customer.read', 'customer.create', 'stock.read'],
  hasGlobalAccess: false,
};
const ADMIN = { permissions: [], hasGlobalAccess: true };

describe('buildAbility', () => {
  it('parse <subject>.<action> → PascalCase subject', () => {
    expect(parsePermission('customer.read')).toEqual({ subject: 'Customer', action: 'read' });
    expect(parsePermission('sales_order.approve')).toEqual({
      subject: 'SalesOrder',
      action: 'approve',
    });
    expect(toSubject('price-list')).toBe('PriceList');
    expect(parsePermission('nodot')).toBeNull();
    expect(parsePermission('x.')).toBeNull();
  });

  it('sale: có đúng quyền được cấp, không hơn', () => {
    const a = buildAbility(SALE);
    expect(a.can('read', 'Customer')).toBe(true);
    expect(a.can('create', 'Customer')).toBe(true);
    expect(a.can('delete', 'Customer')).toBe(false);
    expect(a.can('adjust', 'Stock')).toBe(false);
    expect(a.can('read', 'Role')).toBe(false);
  });

  it('hasGlobalAccess → manage all', () => {
    const a = buildAbility(ADMIN);
    expect(a.can('delete', 'Customer')).toBe(true);
    expect(a.can('whatever', 'Anything')).toBe(true);
  });

  it('null → không có quyền gì', () => {
    expect(buildAbility(null).can('read', 'Customer')).toBe(false);
  });
});

function Probe() {
  const ability = useAbility();
  return <span data-testid="probe">{String(ability.can('read', 'Customer'))}</span>;
}

describe('<Can> / useAbility', () => {
  it('ẩn nút khi thiếu quyền, hiện khi có', () => {
    render(
      <AbilityProvider me={SALE}>
        <Can I="create" a="Customer">
          <button>Tạo khách hàng</button>
        </Can>
        <Can I="delete" a="Customer">
          <button>Xóa khách hàng</button>
        </Can>
        <Probe />
      </AbilityProvider>,
    );
    expect(screen.getByRole('button', { name: 'Tạo khách hàng' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa khách hàng' })).not.toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });

  it('me=null (đang tải) → mọi <Can> ẩn', () => {
    render(
      <AbilityProvider me={null}>
        <Can I="read" a="Customer">
          <span>secret</span>
        </Can>
      </AbilityProvider>,
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
