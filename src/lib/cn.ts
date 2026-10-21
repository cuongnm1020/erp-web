import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import {
  COLOR_NAMES,
  DIALOG_MAX_HEIGHT,
  DIALOG_MAX_WIDTH,
  DURATION_NAMES,
  RADIUS_NAMES,
  SHADOW_NAMES,
  SIZE,
  TEXT_STYLE_NAMES,
} from './design-classes';

/**
 * tailwind-merge chỉ biết thang mặc định của Tailwind — lớp token (`max-w-dialog`, `h-control`,
 * `text-body`, `shadow-dialog`…) phải khai ở đây, nếu không `cn()` giữ cả hai lớp xung đột và lớp
 * nào thắng tuỳ thứ tự CSS (lỗi 2026-10-21: hộp thoại `max-w-6xl` bị co về 440px).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      colors: COLOR_NAMES,
      spacing: Object.keys(SIZE),
      borderRadius: RADIUS_NAMES,
    },
    classGroups: {
      'font-size': [{ text: TEXT_STYLE_NAMES }],
      'max-w': [{ 'max-w': Object.keys(DIALOG_MAX_WIDTH) }],
      'max-h': [{ 'max-h': Object.keys(DIALOG_MAX_HEIGHT) }],
      shadow: [{ shadow: SHADOW_NAMES }],
      duration: [{ duration: DURATION_NAMES }],
    },
  },
});

/** Gộp class Tailwind, class sau ghi đè class trước (chuẩn shadcn/ui). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
