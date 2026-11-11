/**
 * "Luôn lưu trạng thái lọc lần gần nhất" (2026-11-12, user chốt): mỗi danh sách dùng `useListState`
 * nhớ bộ lọc + cỡ trang + sắp xếp của lần xem gần nhất trong localStorage của trình duyệt; mở lại
 * màn bằng URL trần (menu, gõ địa chỉ) thì áp lại. URL có sẵn tham số (link dán, link từ màn khác)
 * luôn thắng — luật 8 giữ nguyên: trạng thái vẫn nằm trên URL.
 *
 * Không nhớ: số trang, ô tìm nhanh `q` (mở lại màn mà còn kẹt một mã đơn cũ thì tưởng mất đơn).
 * Giá trị ngày tuyệt đối (YYYY-MM-DD) chỉ áp lại trong CÙNG ngày đã lưu — sang ngày khác bỏ, để
 * "Hôm nay" của hôm qua không hiện thành số liệu hôm nay (khoảng ngày có cơ chế ghi nhớ riêng ở
 * DateRangeFilter).
 *
 * Chỉ là tham số lọc, không phải dữ liệu nghiệp vụ hay token. Xóa khi đăng xuất.
 */
const PREFIX = 'erp:list:';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

interface Saved {
  /** Ngày (giờ máy) lúc lưu — YYYY-MM-DD. */
  day: string;
  qs: string;
}

function today(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Khóa lưu của một danh sách: đường dẫn + bộ khóa lọc (một màn có thể có nhiều danh sách theo tab).
 * `null` = không nhớ: danh sách nằm trong màn chi tiết một bản ghi (đường dẫn có id) — nhớ theo
 * từng bản ghi chỉ làm đầy bộ nhớ.
 */
export function listMemoryKey(pathname: string, filterKeys: readonly string[]): string | null {
  if (UUID.test(pathname)) return null;
  return `${PREFIX}${pathname}|${[...filterKeys].sort().join(',')}`;
}

/** Phần của query được nhớ: size, sort và các khóa lọc của danh sách — bỏ page, q, tham số khác. */
export function memorableQuery(search: string, filterKeys: readonly string[]): string {
  const src = new URLSearchParams(search);
  const out = new URLSearchParams();
  for (const k of ['size', 'sort', ...filterKeys]) {
    const v = src.get(k);
    if (v !== null && v !== '') out.set(k, v);
  }
  return out.toString();
}

export function readSavedListQuery(key: string | null, now = new Date()): string {
  if (!key) return '';
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return '';
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (typeof saved.qs !== 'string' || saved.qs === '') return '';
    if (saved.day === today(now)) return saved.qs;
    const p = new URLSearchParams(saved.qs);
    for (const [k, v] of [...p]) if (DATE_KEY.test(v)) p.delete(k);
    return p.toString();
  } catch {
    return '';
  }
}

export function writeSavedListQuery(key: string | null, qs: string, now = new Date()): void {
  if (!key) return;
  try {
    if (qs === '') window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ day: today(now), qs } satisfies Saved));
  } catch {
    // Trình duyệt chặn / đầy storage: bỏ qua — danh sách vẫn chạy, chỉ không nhớ.
  }
}

/** Đăng xuất: bộ lọc là của tài khoản vừa thoát. */
export function forgetSavedListStates(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // như trên
  }
}
