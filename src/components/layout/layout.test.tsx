import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AbilityProvider } from '@/lib/permission';
import { requiredAbilityFor, visibleModules } from '@/lib/navigation';
import { crumbsFromPath } from './breadcrumb';
import { Sidebar } from './sidebar';

function renderSidebar(me: { permissions: string[]; hasGlobalAccess: boolean }) {
  return render(
    <AbilityProvider me={me}>
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>
    </AbilityProvider>,
  );
}

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
  beforeEach(() => {
    localStorage.clear();
  });

  it('nhóm là nhãn (không phải link), mục con là link; ẩn theo quyền; đánh dấu mục đang mở', () => {
    renderSidebar(SALE);
    // Module có children giờ là nhãn nhóm, không còn là link
    expect(screen.queryByRole('link', { name: 'Khách hàng' })).not.toBeInTheDocument();
    expect(screen.getByText('Khách hàng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Danh sách khách hàng' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Đơn hàng' })).toBeInTheDocument();
    expect(screen.queryByText('Quản trị')).not.toBeInTheDocument();
    expect(screen.queryByText('Tài chính')).not.toBeInTheDocument();
  });

  it('admin thấy đủ 8 nhóm/mục', () => {
    renderSidebar(ADMIN);
    expect(screen.getByRole('link', { name: 'Tổng quan' })).toBeInTheDocument();
    for (const l of [
      'Bán hàng',
      'Khách hàng',
      'Sản phẩm',
      'Kho',
      'Giá & KM',
      'Tài chính',
      'Quản trị',
    ]) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
  });

  it('thu gọn: chỉ icon (tên vào aria-label), nhớ vào localStorage, phím [ bật lại', () => {
    renderSidebar(SALE);
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn thanh điều hướng' }));
    // Nhãn nhóm biến mất, link vẫn truy cập được qua aria-label
    expect(screen.queryByText('Danh sách khách hàng')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Danh sách khách hàng' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(localStorage.getItem('erp.sidebar.collapsed')).toBe('1');
    // Phím [ mở rộng lại
    fireEvent.keyDown(window, { key: '[' });
    expect(screen.getByText('Danh sách khách hàng')).toBeInTheDocument();
    expect(localStorage.getItem('erp.sidebar.collapsed')).toBe('0');
  });

  it('trạng thái thu gọn sống qua F5 (đọc lại từ localStorage khi mount)', () => {
    localStorage.setItem('erp.sidebar.collapsed', '1');
    renderSidebar(SALE);
    expect(screen.queryByText('Danh sách khách hàng')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' })).toBeInTheDocument();
  });

  it('phím [ không ăn khi đang gõ trong ô nhập', () => {
    renderSidebar(SALE);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: '[' });
    expect(screen.getByText('Danh sách khách hàng')).toBeInTheDocument(); // vẫn mở rộng
    input.remove();
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
