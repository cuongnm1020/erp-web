import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListState } from './url-state';

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
