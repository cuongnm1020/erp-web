#!/usr/bin/env node
/**
 * Kiểm tra mã nguồn theo design system "Thiên Nông ERP" (chạy trong `pnpm lint`):
 *   1. Không pha màu trạng thái bằng độ mờ (`bg-warning/10`, `border-destructive/40`, `bg-flow-*\/10`…)
 *      — nền nhạt là token `*-weak`, viền nhạt là `*-line`.
 *   2. Không chữ dưới 12px trên web (`text-[10px]`, `text-[11px]`).
 *   3. Không hex tự do trong className / style (`#1f5fa8`) — chỉ dùng token.
 *   4. Không đọc token màu kiểu cũ `hsl(var(--x))` — tokens.css ghi kênh RGB.
 * Bỏ qua file test / story / mock (src/test, *.test.*, *.stories.*).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src');

const RULES = [
  {
    re: /\b(?:bg|border|text|ring|from|to)-(?:warning|destructive|success|info|flow-[a-z-]+|telco-[a-z]+|mod-[a-z]+|branch-\d)\/\d+\b/g,
    msg: 'màu trạng thái pha độ mờ — dùng token *-weak (nền) / *-line (viền)',
  },
  { re: /\btext-\[(?:[0-9]|1[01])px\]/g, msg: 'chữ dưới 12px — tối thiểu text-xs (12px) trên web' },
  {
    re: /(?:className|class|style)\s*=\s*(?:\{[^}]*)?["'`][^"'`]*#[0-9a-fA-F]{3,8}\b/g,
    msg: 'hex tự do trong class / style — dùng token',
  },
  { re: /hsl\(var\(--/g, msg: 'hsl(var(--x)) — tokens.css ghi kênh RGB, dùng lớp Tailwind' },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'test' && dir === SRC) continue;
      yield* walk(p);
    } else if (/\.(ts|tsx|css)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name)) {
      yield p;
    }
  }
}

let errors = 0;
for (const file of walk(SRC)) {
  if (file.endsWith('tokens.css')) continue;
  const text = readFileSync(file, 'utf8');
  for (const { re, msg } of RULES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const line = text.slice(0, m.index).split('\n').length;
      console.error(`${relative(root, file)}:${line}: ${msg}: ${m[0]}`);
      errors += 1;
    }
  }
}

if (errors) {
  console.error(`\n${errors} chỗ lệch design system.`);
  process.exit(1);
}
console.error('check-tokens: sạch');
