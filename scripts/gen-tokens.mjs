#!/usr/bin/env node
/**
 * Sinh `src/app/tokens.css` từ `design/tokens.json` (bản chép của design system "Thiên Nông ERP",
 * https://claude.ai/artifact/RwsgPEwCz5QX9hWDjdyW9p → project/tokens.json).
 *
 *   pnpm gen:tokens          # ghi file
 *   pnpm gen:tokens:check    # CI: file đã commit phải khớp với tokens.json
 *
 * Màu hex → kênh "R G B" để Tailwind dùng `rgb(var(--x) / <alpha-value>)`; alias `{other}` được
 * giải tới giá trị gốc nên CSS không có var() lồng nhau. Spacing / radius / shadow / component /
 * duration ghi nguyên giá trị. Chỉ một theme (sáng).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'design/tokens.json');
const OUT = resolve(root, 'src/app/tokens.css');
const check = process.argv.includes('--check');

const tokens = JSON.parse(readFileSync(SRC, 'utf8'));
const theme = tokens.color.themes[0].id;
const colors = new Map(tokens.color.tokens.map((t) => [t.name, t]));

function rawColor(t) {
  const v = t.value;
  return typeof v === 'string' ? v : v[theme];
}

function resolveColor(name, seen = new Set()) {
  const t = colors.get(name);
  if (!t) throw new Error(`tokens.json: alias trỏ tới token không có: ${name}`);
  if (seen.has(name)) throw new Error(`tokens.json: alias vòng tròn tại ${name}`);
  seen.add(name);
  const v = rawColor(t);
  const m = /^\{([A-Za-z0-9_.-]+)\}$/.exec(v);
  return m ? resolveColor(m[1], seen) : v;
}

function hexToChannels(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const names = new Set();
function assertUnique(name) {
  if (names.has(name)) throw new Error(`tokens.json: tên token trùng giữa các nhóm: ${name}`);
  names.add(name);
}

const lines = [];
lines.push(
  `/* SINH TỰ ĐỘNG từ design/tokens.json (${tokens.name} v${tokens.version}, đồng bộ ${tokens.meta?.synced ?? '?'}) bằng \`pnpm gen:tokens\`. KHÔNG sửa tay — sửa tokens.json rồi sinh lại. */`,
);
lines.push(':root {');
lines.push('  /* Màu: kênh R G B (Tailwind: rgb(var(--x) / alpha)); alias đã giải về giá trị gốc. */');
for (const t of tokens.color.tokens) {
  assertUnique(t.name);
  const v = resolveColor(t.name);
  lines.push(`  --${t.name}: ${hexToChannels(v) ?? v};`);
}
for (const fam of ['spacing', 'radius', 'shadow', 'component', 'duration']) {
  const group = tokens[fam];
  if (!group?.tokens) continue;
  lines.push(`  /* ${fam} */`);
  for (const t of group.tokens) {
    assertUnique(t.name);
    lines.push(`  --${t.name}: ${t.value};`);
  }
}
lines.push('}');
const css = lines.join('\n') + '\n';

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== css) {
    console.error(`${OUT} lệch với design/tokens.json — chạy \`pnpm gen:tokens\` rồi commit.`);
    process.exit(1);
  }
  console.error('tokens.css khớp design/tokens.json');
} else {
  writeFileSync(OUT, css);
  console.error(`Đã ghi ${OUT} (${names.size} token).`);
}
