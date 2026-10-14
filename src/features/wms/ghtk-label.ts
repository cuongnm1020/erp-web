/**
 * Tiện ích cho tem vận đơn kiểu GHTK (2026-10-14) — thuần, không I/O, test được.
 *
 * Mã vận đơn GHTK có dạng `S23119447.BO.MN13-12-P52.1763110086`:
 *   - `S23119447`     mã shop trên GHTK ("Người gửi / S23119447")
 *   - `BO`            mã cụm của GHTK (không in)
 *   - `MN13-12-P52`   mã phân loại (sort code) — in to, đoạn đầu `MN13` nền đen
 *   - `1763110086`    mã số ngắn — mã vạch CODE128 của tem mang đúng đoạn này
 */
export interface GhtkTracking {
  shopCode: string;
  sortCode: string;
  /** Đoạn đầu của mã phân loại (trước dấu `-` đầu tiên) — in nền đen. */
  sortHead: string;
  /** Phần còn lại của mã phân loại kể cả dấu `-` đầu, có thể rỗng. */
  sortTail: string;
  shortCode: string;
}

const GHTK_TRACKING = /^(S\d+)\.([A-Z0-9]+)\.([A-Z0-9-]+)\.(\d{6,})$/i;

export function parseGhtkTracking(code: string | null | undefined): GhtkTracking | null {
  const m = code?.trim().match(GHTK_TRACKING);
  if (!m) return null;
  const sortCode = m[3]!;
  const dash = sortCode.indexOf('-');
  return {
    shopCode: m[1]!,
    sortCode,
    sortHead: dash < 0 ? sortCode : sortCode.slice(0, dash),
    sortTail: dash < 0 ? '' : sortCode.slice(dash),
    shortCode: m[4]!,
  };
}

/** `0339213208` → `033***3208` (như tem GHTK). Số quá ngắn → che hết. */
export function maskPhone(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length < 8) return d ? '*'.repeat(d.length) : '';
  return `${d.slice(0, 3)}***${d.slice(-4)}`;
}

/** Che toàn bộ số điện thoại người nhận — tem GHTK in `***********`. */
export function hidePhone(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  return '*'.repeat(Math.max(d.length, 10) + 1);
}

/** Địa chỉ in trên tem: che số nhà / đường (`***`), giữ thôn → tỉnh. */
export function maskedAddress(street: string | null | undefined, locality: string): string {
  const rest = locality.trim();
  if (!street?.trim()) return rest;
  return rest ? `***, ${rest}` : '***';
}

type Region = 'BAC' | 'TRUNG' | 'NAM';

/** Bỏ dấu, chữ thường, bỏ tiền tố "Tỉnh" / "Thành phố" / "TP." — chỉ giữ chữ cái. */
export function normalizeProvince(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/^\s*(tinh|thanh pho|tp\.?)\s+/, '')
    .replace(/[^a-z]/g, '');
}

/**
 * Miền theo tỉnh — gồm cả tên 63 tỉnh cũ lẫn 34 tỉnh sau sáp nhập 2025 (địa chỉ khách còn ghi
 * tên cũ). Chia ba miền hành chính quen thuộc; tỉnh không có trong bảng → không in tuyến.
 */
const REGION: Readonly<Record<string, Region>> = Object.fromEntries([
  ...[
    'hanoi',
    'haiphong',
    'quangninh',
    'bacninh',
    'bacgiang',
    'haiduong',
    'hungyen',
    'thaibinh',
    'namdinh',
    'hanam',
    'ninhbinh',
    'vinhphuc',
    'phutho',
    'thainguyen',
    'backan',
    'caobang',
    'langson',
    'tuyenquang',
    'hagiang',
    'laocai',
    'yenbai',
    'laichau',
    'dienbien',
    'sonla',
    'hoabinh',
  ].map((k) => [k, 'BAC' as const]),
  ...[
    'thanhhoa',
    'nghean',
    'hatinh',
    'quangbinh',
    'quangtri',
    'thuathienhue',
    'hue',
    'danang',
    'quangnam',
    'quangngai',
    'binhdinh',
    'phuyen',
    'khanhhoa',
    'ninhthuan',
    'binhthuan',
    'kontum',
    'gialai',
    'daklak',
    'daknong',
    'lamdong',
  ].map((k) => [k, 'TRUNG' as const]),
  ...[
    'hochiminh',
    'baria',
    'bariavungtau',
    'vungtau',
    'binhduong',
    'binhphuoc',
    'dongnai',
    'tayninh',
    'longan',
    'tiengiang',
    'bentre',
    'travinh',
    'vinhlong',
    'dongthap',
    'angiang',
    'kiengiang',
    'cantho',
    'haugiang',
    'soctrang',
    'baclieu',
    'camau',
  ].map((k) => [k, 'NAM' as const]),
]);

const regionOf = (province: string): Region | null => {
  const k = normalizeProvince(province);
  return REGION[k] ?? (k === 'hcm' || k === 'tphcm' ? 'NAM' : null);
};

/**
 * Tuyến giao in góc phải tem: cùng tỉnh → NỘI TỈNH, cùng miền → NỘI MIỀN, khác miền → LIÊN
 * MIỀN. ERP tự suy từ tỉnh kho lấy và tỉnh người nhận (API GHTK không trả trường này).
 */
export function routeLabel(
  fromProvince: string | null | undefined,
  toProvince: string | null | undefined,
): 'NỘI TỈNH' | 'NỘI MIỀN' | 'LIÊN MIỀN' | null {
  if (!fromProvince || !toProvince) return null;
  if (normalizeProvince(fromProvince) === normalizeProvince(toProvince)) return 'NỘI TỈNH';
  const a = regionOf(fromProvince);
  const b = regionOf(toProvince);
  if (!a || !b) return null;
  return a === b ? 'NỘI MIỀN' : 'LIÊN MIỀN';
}

/** Ghi chú in: ghi chú của đơn + tuỳ chọn xem hàng / gọi shop đã gửi hãng. */
export function printNote(data: {
  note: string | null;
  allowInspection: boolean | null;
  callShopOnFailure: boolean | null;
}): string | null {
  const parts = [
    data.note?.trim() || null,
    data.allowInspection === true
      ? 'Cho xem hàng'
      : data.allowInspection === false
        ? 'Không cho xem hàng'
        : null,
    data.callShopOnFailure ? 'Gọi shop khi không giao được' : null,
  ].filter((x): x is string => !!x);
  return parts.length ? parts.join('. ') : null;
}
