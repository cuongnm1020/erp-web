import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { cn } from './cn';

/**
 * Chặn lặp lại lỗi 2026-10-21: lớp token mà tailwind-merge không biết → `cn()` giữ cả hai lớp xung
 * đột, lớp token luôn thắng theo thứ tự CSS (hộp thoại `max-w-6xl` co về 440px).
 *
 * Duyệt MỌI khoá trong `theme.extend` của tailwind.config: lớp token phải đè được lớp mặc định
 * cùng nhóm và ngược lại. Thêm nhóm mới vào `extend` mà chưa có dòng trong `GROUPS` → test fail.
 */
const GROUPS: Record<string, { prefixes: string[]; baseline: (prefix: string) => string } | null> =
  {
    colors: { prefixes: ['bg', 'text', 'border'], baseline: (p) => `${p}-[#000]` },
    spacing: { prefixes: ['h', 'w', 'p', 'gap', 'top'], baseline: (p) => `${p}-4` },
    maxWidth: { prefixes: ['max-w'], baseline: () => 'max-w-6xl' },
    maxHeight: { prefixes: ['max-h'], baseline: () => 'max-h-96' },
    fontSize: { prefixes: ['text'], baseline: () => 'text-[15px]' },
    boxShadow: { prefixes: ['shadow'], baseline: () => 'shadow-[0_0_0_#000]' },
    borderRadius: { prefixes: ['rounded'], baseline: () => 'rounded-[3px]' },
    transitionDuration: { prefixes: ['duration'], baseline: () => 'duration-150' },
    borderWidth: { prefixes: ['border'], baseline: () => 'border-2' },
    gridTemplateColumns: { prefixes: ['grid-cols'], baseline: () => 'grid-cols-2' },
    // Chỉ đổi giá trị của tên mặc định (font-medium, font-sans…) hoặc không sinh lớp xung đột.
    fontWeight: null,
    fontFamily: null,
    keyframes: null,
    animation: null,
  };

const extend = (config.theme?.extend ?? {}) as Record<string, Record<string, unknown>>;

const classOf = (prefix: string, key: string) => (key === '' ? prefix : `${prefix}-${key}`);

describe('cn() biết mọi lớp token trong tailwind.config', () => {
  it('mọi nhóm trong theme.extend đều có trong GROUPS', () => {
    expect(Object.keys(extend).filter((k) => !(k in GROUPS))).toEqual([]);
  });

  const cases = Object.entries(extend).flatMap(([group, values]) => {
    const g = GROUPS[group];
    if (!g) return [];
    return Object.keys(values)
      .filter((k) => k !== 'DEFAULT')
      .flatMap((k) => g.prefixes.map((p) => [classOf(p, k), g.baseline(p)] as const));
  });

  it.each(cases)('%s đè và bị đè bởi %s', (token, baseline) => {
    expect(cn(baseline, token)).toBe(token);
    expect(cn(token, baseline)).toBe(baseline);
  });

  it('cỡ chữ token và màu chữ là hai nhóm khác nhau — không nuốt nhau', () => {
    expect(cn('text-body', 'text-primary')).toBe('text-body text-primary');
    expect(cn('text-primary', 'text-caption')).toBe('text-primary text-caption');
  });

  it('hộp thoại: lớp đè ở màn thắng max-w-dialog của primitive', () => {
    expect(cn('max-w-dialog', 'max-w-6xl')).toBe('max-w-6xl');
    expect(cn('max-w-dialog', 'max-w-dialog-xl')).toBe('max-w-dialog-xl');
  });
});
