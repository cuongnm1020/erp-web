import { ApiError } from './errors';

export interface FieldError {
  /** Đường dẫn field theo react-hook-form: `phone`, `addresses.0.line1` */
  path: string;
  message: string;
}

/**
 * Rút lỗi theo field từ ApiError để map vào setError() (luật 6, mục 422).
 * Hỗ trợ hai dạng:
 *  1. Theo luật: details = [{ path: 'phone' | ['addresses', 0, 'line1'], message }]
 *  2. Nest ValidationPipe hiện tại: details = ['phone must be a string', 'property x should not exist']
 * Trả [] nếu không phải lỗi validation hoặc không rút được gì.
 */
export function extractFieldErrors(err: ApiError): FieldError[] {
  if (!err.isValidation || !Array.isArray(err.details)) return [];
  const out: FieldError[] = [];
  for (const d of err.details) {
    if (typeof d === 'string') {
      const parsed = parseNestMessage(d);
      if (parsed) out.push(parsed);
    } else if (d !== null && typeof d === 'object') {
      const rec = d as { path?: unknown; message?: unknown; field?: unknown };
      const rawPath = rec.path ?? rec.field;
      const path = Array.isArray(rawPath)
        ? rawPath.map(String).join('.')
        : typeof rawPath === 'string'
          ? rawPath
          : undefined;
      if (path) out.push({ path, message: typeof rec.message === 'string' ? rec.message : '' });
    }
  }
  return dedupeByPath(out);
}

/** "phone must be a string" → { path: 'phone' }. "property foo should not exist" → { path: 'foo' }. */
function parseNestMessage(s: string): FieldError | undefined {
  const prop = /^property (\S+) should not exist$/.exec(s);
  if (prop?.[1]) return { path: prop[1], message: s };
  const m = /^([A-Za-z_][\w.]*)\s+(.+)$/.exec(s);
  if (m?.[1]) return { path: m[1], message: s };
  return undefined;
}

function dedupeByPath(list: FieldError[]): FieldError[] {
  const seen = new Map<string, FieldError>();
  for (const f of list) if (!seen.has(f.path)) seen.set(f.path, f);
  return [...seen.values()];
}
