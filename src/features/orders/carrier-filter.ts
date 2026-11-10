import { carrierAccountOptions, type Carrier } from '@/features/wms/api/use-shipping';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Khớp `{0,99}` trong regex `carrierIds` / `carrierAccountIds` của API. */
const MAX_IDS = 100;

/**
 * Ô "Hãng VC" màn In đơn (2026-11-10, user: "group theo các tài khoản, tìm ghtk ra tất tài khoản
 * ghtk"): mỗi hãng một dòng "GHTK · tất cả tài khoản" (`c:<id>` — gồm cả tài khoản thêm sau này)
 * rồi từng tài khoản của hãng ngay dưới (`a:<id>`, nhãn dùng chung "GHTK S23119447 Tên"). Gõ
 * "ghtk" ra dòng hãng + mọi tài khoản GHTK. Hãng không tài khoản (giao thủ công) chỉ có dòng hãng.
 */
export function carrierFilterOptions(carriers: Carrier[] | undefined) {
  const accounts = carrierAccountOptions(carriers);
  const out: Array<{ value: string; label: string; hint?: string }> = [];
  for (const c of (carriers ?? []).filter((x) => accounts.some((a) => a.carrier.id === x.id))) {
    const mine = accounts.filter((a) => a.carrier.id === c.id && a.accountId);
    out.push({
      value: `c:${c.id}`,
      label: mine.length ? `${c.code} · tất cả tài khoản` : c.name,
      hint: mine.length ? `${mine.length} tài khoản` : 'Hãng',
    });
    for (const a of mine) out.push({ value: `a:${a.accountId}`, label: a.label, hint: c.code });
  }
  return out;
}

/** Tách giá trị ô Hãng VC trên URL thành `carrierIds` / `carrierAccountIds` của API (bỏ id hỏng). */
export function parseCarrierFilter(raw: string | undefined) {
  const picked = (raw ?? '').split(',').filter((v) => /^[ca]:/.test(v) && UUID_RE.test(v.slice(2)));
  const of = (prefix: string) =>
    picked
      .filter((v) => v.startsWith(prefix))
      .map((v) => v.slice(2))
      .slice(0, MAX_IDS)
      .join(',');
  return { value: picked.join(','), carrierIds: of('c:'), carrierAccountIds: of('a:') };
}
