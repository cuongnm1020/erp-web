import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { WarehouseSwitcher } from '@/components/layout/warehouse-switcher';
import { api, unwrap } from '@/lib/api/client';
import type { AuthMe } from '@/lib/permission';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import {
  ALL_WAREHOUSES,
  forgetWarehouseSelection,
  getSelectedWarehouse,
  restoreWarehouse,
  selectWarehouse,
  warehouseHeaders,
} from './current-warehouse';
import { WarehouseProvider } from './warehouse-provider';

/** Kho đang làm việc (PLAN-warehouse-context): store + ô chọn kho + header X-Warehouse-Id. */

const ACCESS = { userId: 'u1', optionIds: ['wh-tt', 'wh-la'], defaultWarehouseId: 'wh-tt' };

const me = (over: Partial<AuthMe> = {}): AuthMe => ({
  userId: 'u1',
  code: 'sale.1',
  roles: ['SALES_MEMBER'],
  permissions: [],
  leaderTeamIds: [],
  careTeamIds: [],
  hasGlobalAccess: false,
  managesDepartments: false,
  managesCareTeam: false,
  warehouseIds: ['wh-la', 'wh-tt'],
  warehouses: [
    { id: 'wh-tt', code: 'KHO-TT-01', name: 'Kho Thạch Thất' },
    { id: 'wh-la', code: 'KHO-LA-01', name: 'Kho Long An' },
  ],
  defaultWarehouseId: 'wh-tt',
  selectedWarehouseId: null,
  mustChangePassword: false,
  ...over,
});

afterEach(() => forgetWarehouseSelection());

describe('current-warehouse store', () => {
  it('đăng nhập (chưa lưu gì) → "Tất cả kho" khi được nhiều kho (2026-10-26); một kho → kho đó', () => {
    expect(restoreWarehouse(ACCESS)).toBe(ALL_WAREHOUSES);
    expect(warehouseHeaders()).toEqual({ 'X-Warehouse-Id': ALL_WAREHOUSES });
    forgetWarehouseSelection();
    expect(restoreWarehouse({ ...ACCESS, optionIds: ['wh-la'], defaultWarehouseId: 'wh-tt' })).toBe(
      'wh-la',
    );
  });

  it('đã chọn trong phiên → F5 giữ nguyên; kho không còn được phép → về kho mặc định', () => {
    restoreWarehouse(ACCESS);
    selectWarehouse(ACCESS, 'wh-la');
    expect(restoreWarehouse(ACCESS)).toBe('wh-la');
    expect(restoreWarehouse({ ...ACCESS, optionIds: ['wh-tt'] })).toBe('wh-tt');
  });

  it('"Tất cả kho" chỉ khi được phép > 1 kho; kho lạ bị bỏ qua', () => {
    restoreWarehouse(ACCESS);
    selectWarehouse(ACCESS, ALL_WAREHOUSES);
    expect(getSelectedWarehouse()).toBe(ALL_WAREHOUSES);
    selectWarehouse(ACCESS, 'wh-khac');
    expect(getSelectedWarehouse()).toBe(ALL_WAREHOUSES);
    const single = { ...ACCESS, optionIds: ['wh-tt'] };
    expect(restoreWarehouse(single)).toBe('wh-tt');
    selectWarehouse(single, ALL_WAREHOUSES);
    expect(getSelectedWarehouse()).toBe('wh-tt');
  });

  it('đăng xuất / đăng nhập lại → quên lựa chọn, không gửi header', () => {
    restoreWarehouse(ACCESS);
    selectWarehouse(ACCESS, 'wh-la');
    forgetWarehouseSelection();
    expect(warehouseHeaders()).toEqual({});
    expect(restoreWarehouse(ACCESS)).toBe(ALL_WAREHOUSES);
  });

  it('chưa được cấp kho nào → không có kho, không header', () => {
    expect(restoreWarehouse({ userId: 'u2', optionIds: [], defaultWarehouseId: null })).toBeNull();
    expect(warehouseHeaders()).toEqual({});
  });
});

describe('Ô chọn kho', () => {
  it('phiên chưa tải → "Đang tải…", khoá (không báo nhầm "Chưa được cấp kho")', () => {
    renderApp(
      <WarehouseProvider me={undefined}>
        <WarehouseSwitcher />
      </WarehouseProvider>,
    );
    expect(screen.getByRole('button', { name: 'Kho đang làm việc: Đang tải…' })).toBeDisabled();
  });

  it('mặc định "Tất cả kho"; chọn "Kho Long An" → request sau mang X-Warehouse-Id của kho đó', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get('/api/warehouses', ({ request }) => {
        seen.push(request.headers.get('x-warehouse-id'));
        return HttpResponse.json([]);
      }),
    );
    renderApp(
      <WarehouseProvider me={me()}>
        <WarehouseSwitcher />
      </WarehouseProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Kho đang làm việc: Tất cả kho' });
    await unwrap(api.GET('/warehouses'));
    expect(seen).toEqual([ALL_WAREHOUSES]);

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Kho Long An/ }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Kho đang làm việc: Kho Long An' }),
      ).toBeInTheDocument(),
    );
    await unwrap(api.GET('/warehouses'));
    expect(seen).toEqual([ALL_WAREHOUSES, 'wh-la']);
  });

  it('có "Tất cả kho" khi được phép nhiều kho; chỉ một kho → ô bị khoá', async () => {
    const { unmount } = renderApp(
      <WarehouseProvider me={me()}>
        <WarehouseSwitcher />
      </WarehouseProvider>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: /Kho đang làm việc/ }), {
      key: 'ArrowDown',
    });
    expect(await screen.findByRole('menuitem', { name: /Tất cả kho/ })).toBeInTheDocument();
    unmount();
    forgetWarehouseSelection();

    renderApp(
      <WarehouseProvider
        me={me({
          warehouseIds: ['wh-tt'],
          warehouses: [{ id: 'wh-tt', code: 'KHO-TT-01', name: 'Kho Thạch Thất' }],
        })}
      >
        <WarehouseSwitcher />
      </WarehouseProvider>,
    );
    expect(
      screen.getByRole('button', { name: 'Kho đang làm việc: Kho Thạch Thất' }),
    ).toBeDisabled();
  });
});
