import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gộp class Tailwind, class sau ghi đè class trước (chuẩn shadcn/ui). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
