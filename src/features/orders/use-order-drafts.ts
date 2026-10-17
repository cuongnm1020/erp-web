'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyOrderValues, type CreateOrderValues } from './schema';

/**
 * Tab đơn nháp của màn tạo đơn (2026-10-17) — mở nhiều đơn cùng lúc (sale đang chat với vài
 * khách). Chỉ là tiện ích trên MÁY NÀY: lưu localStorage, không lên server (API không có đơn
 * nháp); trình duyệt chặn / xoá storage thì vẫn chạy, chỉ mất nháp khi tải lại trang.
 */
export interface OrderDraft {
  id: string;
  /** Số thứ tự hiện trên tab ("Đơn mới 2"). */
  no: number;
  values: CreateOrderValues;
  /** Nguồn tạo nháp (`from:<orderId>` / `customer:<id>`) — mở lại link cũ không nhân bản tab. */
  origin?: string;
}

interface DraftState {
  drafts: OrderDraft[];
  activeId: string;
}

const STORAGE_KEY = 'erp.order-drafts.v1';
const MAX_DRAFTS = 10;

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeDraft(no: number, values: CreateOrderValues, origin?: string): OrderDraft {
  return { id: newId(), no, values, ...(origin ? { origin } : {}) };
}

function load(): DraftState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!Array.isArray(parsed.drafts) || parsed.drafts.length === 0) return null;
    // Nháp lưu từ bản cũ hơn có thể thiếu trường mới — đắp lên giá trị trống.
    const drafts = parsed.drafts.map((d) => ({
      ...d,
      values: { ...emptyOrderValues(), ...d.values },
    }));
    const activeId = drafts.some((d) => d.id === parsed.activeId) ? parsed.activeId : drafts[0]!.id;
    return { drafts, activeId };
  } catch {
    return null;
  }
}

function save(state: DraftState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage bị chặn / đầy — nháp chỉ sống trong phiên này.
  }
}

export function useOrderDrafts(defaultWarehouseId: string) {
  const [state, setState] = useState<DraftState>(() => {
    const first = makeDraft(1, emptyOrderValues(defaultWarehouseId));
    return { drafts: [first], activeId: first.id };
  });
  const [ready, setReady] = useState(false);
  const defaultWh = useRef(defaultWarehouseId);
  defaultWh.current = defaultWarehouseId;

  // Đọc storage SAU khi mount — render server và lần render đầu ở client phải giống nhau.
  useEffect(() => {
    const stored = load();
    if (stored) setState(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(state);
  }, [state, ready]);

  const nextNo = (drafts: OrderDraft[]) => drafts.reduce((m, d) => Math.max(m, d.no), 0) + 1;

  /** Mở tab nháp mới (F6). `origin` trùng một tab đang mở → chuyển sang tab đó. */
  const openDraft = useCallback((values?: CreateOrderValues, origin?: string) => {
    setState((s) => {
      const existing = origin ? s.drafts.find((d) => d.origin === origin) : undefined;
      if (existing) return { ...s, activeId: existing.id };
      // Quá số tab: bỏ tab cũ nhất (đầu danh sách) để không phình storage.
      const kept = s.drafts.length >= MAX_DRAFTS ? s.drafts.slice(1) : s.drafts;
      const d = makeDraft(nextNo(s.drafts), values ?? emptyOrderValues(defaultWh.current), origin);
      return { drafts: [...kept, d], activeId: d.id };
    });
  }, []);

  /** Đóng tab; đóng tab cuối thì mở sẵn một tab trống. */
  const closeDraft = useCallback((id: string) => {
    setState((s) => {
      const idx = s.drafts.findIndex((d) => d.id === id);
      if (idx < 0) return s;
      const rest = s.drafts.filter((d) => d.id !== id);
      if (rest.length === 0) {
        const d = makeDraft(1, emptyOrderValues(defaultWh.current));
        return { drafts: [d], activeId: d.id };
      }
      const activeId = s.activeId === id ? rest[Math.min(idx, rest.length - 1)]!.id : s.activeId;
      return { drafts: rest, activeId };
    });
  }, []);

  const activate = useCallback((id: string) => {
    setState((s) => (s.drafts.some((d) => d.id === id) ? { ...s, activeId: id } : s));
  }, []);

  const updateValues = useCallback((id: string, values: CreateOrderValues) => {
    setState((s) => ({
      ...s,
      drafts: s.drafts.map((d) => (d.id === id ? { ...d, values } : d)),
    }));
  }, []);

  const active = state.drafts.find((d) => d.id === state.activeId) ?? state.drafts[0]!;
  return { drafts: state.drafts, active, ready, openDraft, closeDraft, activate, updateValues };
}
