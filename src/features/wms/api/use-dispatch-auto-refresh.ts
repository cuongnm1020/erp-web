'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { taskKeys } from './use-tasks';
import { waveKeys } from './use-waves';

/** Chu kỳ tự tải lại bảng điều phối. */
export const DISPATCH_REFRESH_MS = 15_000;

/**
 * Tự tải lại bảng điều phối (2026-10-12): việc mới sinh, việc vừa được nhận / làm xong, dòng
 * thiếu tồn vừa được tự lập lại sau khi cất hàng… hiện ra mà không phải F5. Realtime chưa phủ đủ
 * các sự kiện đó nên vẫn hỏi lại định kỳ. Cùng đường với realtime (luật 9): chỉ invalidate prefix
 * `['wms','tasks']` + `['wms','waves']` — TanStack chỉ gọi lại query đang hiển thị, dữ liệu cũ giữ
 * trên màn tới khi bản mới về, việc đang tick chọn không mất. Tab trình duyệt ẩn thì không hỏi;
 * mở lại tab là tải ngay.
 */
export function useDispatchAutoRefresh(enabled: boolean): { refresh: () => void } {
  const qc = useQueryClient();
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: taskKeys.all });
    void qc.invalidateQueries({ queryKey: waveKeys.all });
  }, [qc]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, DISPATCH_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  return { refresh };
}

/** Bật/tắt tự tải lại — nhớ theo trình duyệt (tiện ích cá nhân, không phải dữ liệu nghiệp vụ). */
const PREF_KEY = 'erp.dispatch.autoRefresh';

export function useDispatchAutoRefreshPref(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(PREF_KEY) === 'off') setOn(false);
    } catch {
      // localStorage bị chặn (cửa sổ riêng tư…) → giữ mặc định bật
    }
  }, []);
  const set = useCallback((next: boolean) => {
    setOn(next);
    try {
      window.localStorage.setItem(PREF_KEY, next ? 'on' : 'off');
    } catch {
      // không lưu được thì chỉ có hiệu lực trong phiên này
    }
  }, []);
  return [on, set];
}
