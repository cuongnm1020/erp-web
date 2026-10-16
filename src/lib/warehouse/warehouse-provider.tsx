'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AuthMe } from '@/lib/permission';
import {
  canSelectAll,
  getSelectedWarehouse,
  restoreWarehouse,
  selectWarehouse,
  subscribeWarehouse,
  type WarehouseAccess,
} from './current-warehouse';

export type WarehouseOption = AuthMe['warehouses'][number];

export interface WarehouseContextValue {
  /** Kho được phép (từ /auth/me) — cũng là danh sách kho cấp được cho người khác. */
  options: WarehouseOption[];
  /** uuid kho, `ALL_WAREHOUSES`, hoặc null = chưa được cấp kho nào. */
  selected: string | null;
  allowAll: boolean;
  /** false khi /auth/me chưa về — chưa biết kho được phép. */
  ready: boolean;
  select: (value: string) => void;
}

const WarehouseContext = createContext<WarehouseContextValue>({
  options: [],
  selected: null,
  allowAll: false,
  ready: false,
  select: () => undefined,
});

/**
 * Cung cấp kho đang làm việc cho cây đã đăng nhập (bọc trong SessionProvider). Kho chốt NGAY trong
 * render đầu tiên có `me` để query của màn con không chạy với header rỗng rồi chạy lại.
 */
export function WarehouseProvider({
  me,
  children,
}: {
  me: AuthMe | undefined;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const options = useMemo(() => me?.warehouses ?? [], [me?.warehouses]);
  const access = useMemo<WarehouseAccess | null>(
    () =>
      me
        ? {
            userId: me.userId,
            optionIds: options.map((o) => o.id),
            defaultWarehouseId: me.defaultWarehouseId,
          }
        : null,
    [me, options],
  );
  // Chốt đồng bộ trong render (không phát sự kiện) — idempotent theo `access`.
  const restored = useMemo(() => (access ? restoreWarehouse(access) : null), [access]);
  const selected = useSyncExternalStore(subscribeWarehouse, getSelectedWarehouse, () => restored);

  const select = useCallback(
    (value: string) => {
      if (!access || value === getSelectedWarehouse()) return;
      selectWarehouse(access, value);
      // Đổi kho đổi phạm vi dữ liệu của MỌI màn → bỏ cache mọi query (trừ phiên đăng nhập: /auth/me
      // không đổi theo kho) thay vì invalidate theo prefix từng module.
      void qc.resetQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    },
    [access, qc],
  );

  const value = useMemo<WarehouseContextValue>(
    () => ({
      options,
      selected,
      allowAll: canSelectAll({ optionIds: options.map((o) => o.id) }),
      ready: access !== null,
      select,
    }),
    [options, selected, access, select],
  );
  return <WarehouseContext.Provider value={value}>{children}</WarehouseContext.Provider>;
}

export function useWarehouse(): WarehouseContextValue {
  return useContext(WarehouseContext);
}
