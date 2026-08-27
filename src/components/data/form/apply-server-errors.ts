import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { extractFieldErrors } from '@/lib/api/form-errors';
import { isApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';

/**
 * Luật 6 (422): map details[].path → setError, cuộn/focus tới field sai đầu tiên.
 * Field không có trong form → gom vào root ('root.server') để hiển thị chung.
 * Lỗi không phải validation → root với câu từ bộ dịch. Trả về số field đã gắn lỗi.
 */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  err: unknown,
  opts: { knownFields?: readonly string[]; focus?: boolean } = {},
): number {
  if (!isApiError(err) || !err.isValidation) {
    form.setError('root.server', { type: 'server', message: messageFor(err) });
    return 0;
  }
  const fields = extractFieldErrors(err);
  const known = opts.knownFields ? new Set(opts.knownFields) : undefined;
  const values = form.getValues() as Record<string, unknown>;
  let first: string | undefined;
  let applied = 0;
  const unknownMsgs: string[] = [];

  for (const f of fields) {
    const root = f.path.split('.')[0] ?? f.path;
    const exists = known ? known.has(f.path) || known.has(root) : root in values;
    if (!exists) {
      unknownMsgs.push(f.message || f.path);
      continue;
    }
    form.setError(f.path as Path<T>, { type: 'server', message: f.message || 'Không hợp lệ' });
    first ??= f.path;
    applied++;
  }

  if (unknownMsgs.length || applied === 0) {
    form.setError('root.server', {
      type: 'server',
      message: applied === 0 ? messageFor(err) : 'Một số trường khác chưa hợp lệ.',
    });
  }
  if (first && opts.focus !== false) {
    try {
      form.setFocus(first as Path<T>);
    } catch {
      // field chưa mount (tab khác) — bỏ qua, lỗi vẫn hiện ở FormMessage
    }
    if (typeof document !== 'undefined') {
      const el = document.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`);
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
  }
  return applied;
}
