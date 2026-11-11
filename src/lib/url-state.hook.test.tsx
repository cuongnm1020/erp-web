import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetListStateClientFlag, useListState } from './url-state';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const defaults = { filterKeys: ['status', 'carrier'] as const };

beforeEach(() => {
  search = '';
  replace.mockClear();
  window.localStorage.clear();
  resetListStateClientFlag();
});

describe('useListState — nhớ bộ lọc lần gần nhất (2026-11-12)', () => {
  const KEY = 'erp:list:/crm/orders|carrier,status';
  const saved = () => JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { qs: string };

  it('đổi bộ lọc → lưu size / sort / lọc; không lưu page, q, tham số ngoài danh sách', () => {
    search = 'status=SHIPPED&page=3&q=SO2611&size=100&sort=total:desc&tab=all';
    renderHook(() => useListState(defaults));
    expect(saved().qs).toBe('size=100&sort=total%3Adesc&status=SHIPPED');
  });

  it('điều hướng trong app tới URL trần → render đầu đã có bộ lọc đã nhớ, rồi ghi lên URL', () => {
    search = 'status=SHIPPED&size=100';
    renderHook(() => useListState(defaults)).unmount();
    search = '';
    replace.mockClear();
    const seen: string[] = [];
    const { result } = renderHook(() => {
      const r = useListState(defaults);
      seen.push(`${r.state.filters.status ?? ''}/${r.state.size}`);
      return r;
    });
    expect(seen[0]).toBe('SHIPPED/100');
    expect(result.current.skipTake).toEqual({ skip: 0, take: 100 });
    expect(replace).toHaveBeenCalledWith('/crm/orders?size=100&status=SHIPPED', { scroll: false });
    // Chưa áp lên URL thì không được ghi đè bản đã nhớ bằng rỗng.
    expect(saved().qs).toBe('size=100&status=SHIPPED');
  });

  it('tải cứng trang (hydrate): render đầu theo URL, sau khi mount mới ghi bộ lọc lên URL', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ day: '2000-01-01', qs: 'status=NEW&from=2000-01-01&to=2000-01-01' }),
    );
    const { result } = renderHook(() => useListState(defaults));
    expect(result.current.state.filters).toEqual({});
    // Lưu từ ngày khác → bỏ giá trị ngày tuyệt đối, giữ phần còn lại.
    expect(replace).toHaveBeenCalledWith('/crm/orders?status=NEW', { scroll: false });
  });

  it('URL có sẵn tham số thắng bản đã nhớ; xóa hết lọc → quên', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ day: '2000-01-01', qs: 'status=NEW' }));
    search = 'carrier=VTP';
    const { result, rerender } = renderHook(() => useListState(defaults));
    expect(result.current.state.filters).toEqual({ carrier: 'VTP' });
    expect(replace).not.toHaveBeenCalled();
    expect(saved().qs).toBe('carrier=VTP');
    search = '';
    rerender();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current.state.filters).toEqual({});
  });

  it('danh sách trong màn chi tiết (đường dẫn có id) không nhớ', async () => {
    const { listMemoryKey } = await import('./list-state-memory');
    expect(
      listMemoryKey('/crm/customers/0b0e7a52-1c7e-4a39-9f0e-2f5c1f7f9a11', ['status']),
    ).toBeNull();
  });
});

describe('useListState — nhiều set liền nhau trong một nhịp', () => {
  it('"Xóa lọc": set({ q: "" }) rồi set({ filters }) → URL cuối không còn q lẫn filter', () => {
    search = 'q=0345132453&status=SHIPPED&tab=all';
    const { result } = renderHook(() => useListState(defaults));
    act(() => {
      // router.replace chưa áp — useSearchParams vẫn trả URL cũ giữa hai lần gọi.
      result.current.set({ q: '' });
      result.current.set({ filters: { status: undefined, carrier: undefined } });
    });
    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenLastCalledWith('/crm/orders?tab=all', { scroll: false });
  });

  it('URL thật đổi sau đó → set dựng từ URL mới, không dùng bản chờ cũ', () => {
    search = 'q=abc';
    const { result, rerender } = renderHook(() => useListState(defaults));
    act(() => result.current.set({ q: 'xyz' }));
    search = 'status=NEW';
    rerender();
    act(() => result.current.set({ filters: { carrier: 'VTP' } }));
    expect(replace).toHaveBeenLastCalledWith('/crm/orders?carrier=VTP', { scroll: false });
  });
});
