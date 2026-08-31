import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AbilityProvider } from '@/lib/permission';
import { requiredAbilityFor, visibleModules } from '@/lib/navigation';
import { crumbsFromPath } from './breadcrumb';
import { Sidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/customers',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const SALE = { permissions: ['customer.read', 'sales_order.read'], hasGlobalAccess: false };
const ADMIN = { permissions: [], hasGlobalAccess: true };

describe('visibleModules', () => {
  it('sale không thấy Tài chính/Quản trị; con "Tạo đơn" bị ẩn vì thiếu create', () => {
    const mods = visibleModules((a, s) => {
      const ab = new Set(['read:Customer', 'read:SalesOrder']);
      return ab.has(`${a}:${s}`);
    });
    const labels = mods.map((m) => m.label);
    expect(labels).toContain('Bán hàng');
    expect(labels).toContain('Khách hàng');
    expect(labels).not.toContain('Tài chính');
    expect(labels).not.toContain('Quản trị');
    const orders = mods.find((m) => m.label === 'Bán hàng')!;
    expect(orders.children?.map((c) => c.label)).not.toContain('Tạo đơn');
    expect(orders.children?.map((c) => c.label)).toContain('Đơn hàng');
    // Không có product.read / stock.read → cả module ẩn (mọi con đều bị ẩn)
    expect(labels).not.toContain('Sản phẩm');
    expect(labels).not.toContain('Kho');
  });

  it('không có quyền nào → chỉ thấy Tổng quan và Giá & KM (chưa có subject backend)', () => {
    expect(visibleModules(() => false).map((m) => m.label)).toEqual(['Tổng quan', 'Giá & KM']);
  });

  it('chỉ có shipment.read → module Kho hiện đúng một mục Theo dõi giao hàng', () => {
    const mods = visibleModules((a, s) => a === 'read' && s === 'Shipment');
    const wms = mods.find((m) => m.label === 'Kho');
    expect(wms?.children?.map((c) => c.label)).toEqual(['Theo dõi giao hàng']);
  });

  it('admin thấy đủ 8 module', () => {
    expect(visibleModules(() => true)).toHaveLength(8);
  });
});

describe('requiredAbilityFor — quyền mở trang theo URL', () => {
  it('khớp tiền tố dài nhất, gồm cả route con ([id], /edit)', () => {
    expect(requiredAbilityFor('/catalog/products')).toEqual({
      action: 'read',
      subject: 'Product',
    });
    expect(requiredAbilityFor('/catalog/products/abc-123')).toEqual({
      action: 'read',
      subject: 'Product',
    });
    expect(requiredAbilityFor('/crm/customers/abc/edit')).toEqual({
      action: 'read',
      subject: 'Customer',
    });
    expect(requiredAbilityFor('/crm/orders/new')).toEqual({
      action: 'create',
      subject: 'SalesOrder',
    });
  });

  it('module không gắn ability nhưng mục con cùng href có → vẫn gate (Kho, Sản phẩm)', () => {
    expect(requiredAbilityFor('/wms/stock')).toEqual({ action: 'read', subject: 'Stock' });
    expect(requiredAbilityFor('/wms/shipping')).toEqual({ action: 'read', subject: 'Shipment' });
  });

  it("route ngoài nav hoặc chưa có quyền backend → null ('/' chỉ khớp chính xác)", () => {
    expect(requiredAbilityFor('/')).toBeNull();
    expect(requiredAbilityFor('/me')).toBeNull();
    expect(requiredAbilityFor('/pricing/promotions')).toBeNull();
    expect(requiredAbilityFor('/crm/returns')).toBeNull();
  });
});

describe('<Sidebar>', () => {
  it('ẩn mục không có quyền, đánh dấu mục đang mở', () => {
    render(
      <AbilityProvider me={SALE}>
        <Sidebar />
      </AbilityProvider>,
    );
    expect(screen.getByRole('link', { name: 'Khách hàng' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Bán hàng' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quản trị' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tài chính' })).not.toBeInTheDocument();
  });

  it('admin thấy 8 module', () => {
    render(
      <AbilityProvider me={ADMIN}>
        <Sidebar />
      </AbilityProvider>,
    );
    for (const l of [
      'Tổng quan',
      'Bán hàng',
      'Khách hàng',
      'Sản phẩm',
      'Kho',
      'Giá & KM',
      'Tài chính',
      'Quản trị',
    ]) {
      expect(screen.getByRole('link', { name: l })).toBeInTheDocument();
    }
  });
});

describe('crumbsFromPath', () => {
  it('map nhãn tiếng Việt, UUID → Chi tiết, mục cuối không có link', () => {
    const c = crumbsFromPath('/crm/customers/3f2a1b6c-1111-4222-8333-444455556666/edit');
    expect(c.map((x) => x.label)).toEqual(['CRM', 'Khách hàng', 'Chi tiết', 'Chỉnh sửa']);
    expect(c[1]?.href).toBe('/crm/customers');
    expect(c[3]?.href).toBeUndefined();
  });
});
