'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Trạng thái danh sách nằm trên URL (luật 8): page / size / sort / q / filter.
 * F5 giữ nguyên, dán link cho đồng nghiệp ra đúng kết quả.
 *
 * URL: ?page=2&size=50&sort=name:desc&q=abc&owner=u1&status=ACTIVE
 *   - page 1-based; size; sort "field" hoặc "field:desc"; q tìm nhanh
 *   - mọi key khác nằm trong `filterKeys` là filter
 */
export interface SortState {
  id: string;
  desc: boolean;
}

export interface ListState<F extends string = string> {
  page: number;
  size: number;
  sort: SortState | null;
  q: string;
  filters: Partial<Record<F, string>>;
}

export interface ListStateDefaults<F extends string = string> {
  size?: number;
  sort?: SortState | null;
  filterKeys?: readonly F[];
  /** Giới hạn size để không ai dán ?size=100000 */
  maxSize?: number;
}

const DEFAULT_SIZE = 50;
const MAX_SIZE = 200;

export function parseListState<F extends string = string>(
  params: URLSearchParams,
  defaults: ListStateDefaults<F> = {},
): ListState<F> {
  const size0 = defaults.size ?? DEFAULT_SIZE;
  const page = clampInt(params.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
  const size = clampInt(params.get('size'), size0, 1, defaults.maxSize ?? MAX_SIZE);
  const sortRaw = params.get('sort');
  const sort = sortRaw ? parseSort(sortRaw) : (defaults.sort ?? null);
  const q = params.get('q')?.trim() ?? '';
  const filters: Partial<Record<F, string>> = {};
  for (const k of defaults.filterKeys ?? []) {
    const v = params.get(k);
    if (v !== null && v !== '') filters[k] = v;
  }
  return { page, size, sort, q, filters };
}

/** Chỉ ghi lên URL những gì khác mặc định → URL ngắn, sạch. */
export function serializeListState<F extends string = string>(
  state: ListState<F>,
  defaults: ListStateDefaults<F> = {},
): URLSearchParams {
  const p = new URLSearchParams();
  if (state.page > 1) p.set('page', String(state.page));
  if (state.size !== (defaults.size ?? DEFAULT_SIZE)) p.set('size', String(state.size));
  const defSort = defaults.sort ?? null;
  if (state.sort && !sameSort(state.sort, defSort)) p.set('sort', formatSort(state.sort));
  if (!state.sort && defSort) p.set('sort', 'none');
  if (state.q) p.set('q', state.q);
  for (const [k, v] of Object.entries(state.filters)) {
    if (typeof v === 'string' && v !== '') p.set(k, v);
  }
  return p;
}

/** skip/take cho API offset (apps/api ListQueryDto). */
export function toSkipTake(state: Pick<ListState, 'page' | 'size'>): {
  skip: number;
  take: number;
} {
  return { skip: (state.page - 1) * state.size, take: state.size };
}

export function parseSort(s: string): SortState | null {
  if (s === 'none') return null;
  const [id, dir] = s.split(':');
  if (!id) return null;
  return { id, desc: dir === 'desc' };
}

export function formatSort(s: SortState): string {
  return s.desc ? `${s.id}:desc` : s.id;
}

function sameSort(a: SortState | null, b: SortState | null): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id && a.desc === b.desc;
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  if (raw === null) return def;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/**
 * Hook: đọc state từ URL, `set(patch)` ghi lại bằng router.replace (không thêm history).
 * Đổi filter/q/size/sort → page về 1 trừ khi patch ghi rõ page.
 */
export function useListState<F extends string = string>(defaults: ListStateDefaults<F> = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramsKey = params.toString();
  const defaultsRef = useMemo(() => defaults, [defaults]);

  const state = useMemo(
    () => parseListState<F>(new URLSearchParams(paramsKey), defaultsRef),
    [paramsKey, defaultsRef],
  );

  const set = useCallback(
    (patch: Partial<ListState<F>>) => {
      const resetsPage =
        patch.page === undefined &&
        ('filters' in patch || 'q' in patch || 'size' in patch || 'sort' in patch);
      const next: ListState<F> = {
        ...state,
        ...patch,
        page: resetsPage ? 1 : (patch.page ?? state.page),
      };
      const listParams = serializeListState(next, defaultsRef);
      // Giữ lại param không thuộc danh sách (ví dụ tab, scope).
      const merged = new URLSearchParams(paramsKey);
      for (const k of ['page', 'size', 'sort', 'q', ...(defaultsRef.filterKeys ?? [])])
        merged.delete(k);
      for (const [k, v] of listParams) merged.set(k, v);
      const qs = merged.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [state, defaultsRef, paramsKey, pathname, router],
  );

  return { state, set, skipTake: toSkipTake(state) };
}
