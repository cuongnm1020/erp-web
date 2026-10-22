import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDLE_STORAGE_KEY,
  IDLE_TIMEOUT_MS,
  isIdleExpired,
  readLastActivity,
} from '@/lib/auth/idle';
import { useIdleLogout } from './use-idle-logout';

const MIN = 60_000;
const T0 = new Date('2026-10-18T08:00:00Z').getTime();

describe('isIdleExpired', () => {
  it('chưa có mốc → chưa hết; đủ 2 giờ → hết', () => {
    expect(isIdleExpired(null, T0)).toBe(false);
    expect(isIdleExpired(T0, T0 + IDLE_TIMEOUT_MS - 1)).toBe(false);
    expect(isIdleExpired(T0, T0 + IDLE_TIMEOUT_MS)).toBe(true);
  });
});

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('không thao tác 2 giờ → gọi onIdle đúng một lần', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(onIdle));
    expect(readLastActivity()).toBe(T0);
    act(() => vi.advanceTimersByTime(119 * MIN));
    expect(onIdle).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(MIN + 15_000));
    expect(onIdle).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(10 * MIN));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('có thao tác thì tính lại từ lần thao tác cuối', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(onIdle));
    act(() => vi.advanceTimersByTime(80 * MIN));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    act(() => vi.advanceTimersByTime(80 * MIN));
    expect(onIdle).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(41 * MIN));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('máy ngủ (timer đứng) rồi thức: thao tác đầu tiên đăng xuất, không gia hạn mốc', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(onIdle));
    // Đồng hồ nhảy 2 giờ mà interval không kịp chạy.
    vi.setSystemTime(T0 + 120 * MIN);
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerdown'));
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(readLastActivity()).toBe(T0);
  });

  it('mở trang khi mốc cũ đã quá 2 giờ → đăng xuất ngay', () => {
    window.localStorage.setItem(IDLE_STORAGE_KEY, String(T0 - 121 * MIN));
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(onIdle));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('tab khác vừa thao tác (mốc chung localStorage) → tab này không đăng xuất', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(onIdle));
    act(() => vi.advanceTimersByTime(25 * MIN));
    window.localStorage.setItem(IDLE_STORAGE_KEY, String(Date.now()));
    act(() => vi.advanceTimersByTime(10 * MIN));
    expect(onIdle).not.toHaveBeenCalled();
  });
});
