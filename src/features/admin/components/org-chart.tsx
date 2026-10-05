'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { OrgDepartmentNode } from '../api/use-org-tree';

/**
 * Sơ đồ nhân sự dạng cây dọc (giống sơ đồ giấy của công ty): mỗi ô = một phòng ban, hiện
 * "Tên: số người" (cộng dồn cả phòng ban con) và trưởng phòng. Chỉ vẽ — dữ liệu từ
 * GET /org/tree, đường nối vẽ bằng CSS `.org-chart` (globals.css).
 *
 * Màu: các ô "thân" (công ty → ban giám đốc, mỗi cấp chỉ một con) dùng màu chính; từ cấp đầu
 * tiên có nhiều nhánh, mỗi nhánh một màu `branch-N` và con cháu kế thừa màu nhánh.
 */

/** Class đầy đủ để Tailwind quét được (không ghép chuỗi động). */
const BRANCH = [
  {
    head: 'bg-branch-1 text-primary-foreground',
    box: 'bg-branch-1-weak border-branch-1',
    text: 'text-branch-1',
  },
  {
    head: 'bg-branch-2 text-primary-foreground',
    box: 'bg-branch-2-weak border-branch-2',
    text: 'text-branch-2',
  },
  {
    head: 'bg-branch-3 text-primary-foreground',
    box: 'bg-branch-3-weak border-branch-3',
    text: 'text-branch-3',
  },
  {
    head: 'bg-branch-4 text-primary-foreground',
    box: 'bg-branch-4-weak border-branch-4',
    text: 'text-branch-4',
  },
  {
    head: 'bg-branch-5 text-primary-foreground',
    box: 'bg-branch-5-weak border-branch-5',
    text: 'text-branch-5',
  },
  {
    head: 'bg-branch-6 text-primary-foreground',
    box: 'bg-branch-6-weak border-branch-6',
    text: 'text-branch-6',
  },
  {
    head: 'bg-branch-7 text-primary-foreground',
    box: 'bg-branch-7-weak border-branch-7',
    text: 'text-branch-7',
  },
  {
    head: 'bg-branch-8 text-primary-foreground',
    box: 'bg-branch-8-weak border-branch-8',
    text: 'text-branch-8',
  },
] as const;

type Tone = { kind: 'trunk' } | { kind: 'head'; branch: number } | { kind: 'box'; branch: number };

export function OrgChart({
  roots,
  selectedId,
  onSelect,
  collapsed,
  onToggle,
}: {
  roots: OrgDepartmentNode[];
  selectedId: string | null;
  onSelect: (node: OrgDepartmentNode) => void;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  // Nhiều gốc = nhánh ngay từ cấp 0; một gốc = thân.
  const rootTone = (i: number): Tone =>
    roots.length > 1 ? { kind: 'head', branch: i } : { kind: 'trunk' };
  return (
    <div className="org-chart inline-block min-w-full px-4 pb-6 pt-2">
      <ul>
        {roots.map((n, i) => (
          <ChartNode
            key={n.id}
            node={n}
            tone={rootTone(i)}
            selectedId={selectedId}
            onSelect={onSelect}
            collapsed={collapsed}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </div>
  );
}

function ChartNode({
  node,
  tone,
  selectedId,
  onSelect,
  collapsed,
  onToggle,
}: {
  node: OrgDepartmentNode;
  tone: Tone;
  selectedId: string | null;
  onSelect: (node: OrgDepartmentNode) => void;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const open = !collapsed.has(node.id);
  const childTone = (i: number): Tone => {
    if (tone.kind !== 'trunk') return { kind: 'box', branch: tone.branch };
    // Thân tách nhánh ở cấp đầu tiên có ≥ 2 con.
    return node.children.length > 1 ? { kind: 'head', branch: i } : { kind: 'trunk' };
  };
  const palette = tone.kind === 'trunk' ? null : BRANCH[tone.branch % BRANCH.length]!;
  const selected = selectedId === node.id;
  // Mở link `?dept=` (hoặc chọn ô ở mép) → cuộn ô vào giữa khung; jsdom không có scrollIntoView.
  const boxRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) boxRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [selected]);

  return (
    <li>
      <div className="relative">
        <button
          ref={boxRef}
          type="button"
          onClick={() => onSelect(node)}
          aria-pressed={selected}
          aria-label={`${node.name}: ${node.memberCount} người${node.managerName ? `, trưởng phòng ${node.managerName}` : ''}`}
          className={cn(
            'flex min-w-28 max-w-44 flex-col items-center rounded-md border px-3 py-1.5 text-center text-xs leading-tight shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            tone.kind === 'trunk' && 'border-primary bg-primary text-primary-foreground',
            tone.kind === 'head' && cn('border-transparent font-semibold', palette!.head),
            tone.kind === 'box' && cn('text-foreground', palette!.box),
            selected && 'ring-2 ring-ring ring-offset-2',
            !node.isActive && 'opacity-60',
          )}
        >
          <span className={cn('font-semibold', tone.kind === 'trunk' && 'text-sm uppercase')}>
            {node.name}: <span className="tabular-nums">{node.memberCount}</span>
          </span>
          {node.managerName ? (
            <span
              className={cn(
                'mt-0.5 text-xs font-normal',
                tone.kind === 'box' ? 'text-muted-foreground' : 'opacity-90',
              )}
            >
              {node.managerName}
            </span>
          ) : null}
        </button>
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={open ? `Thu gọn ${node.name}` : `Mở rộng ${node.name}`}
            aria-expanded={open}
            className={cn(
              'absolute -bottom-2 left-1/2 z-10 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border border-input bg-background text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              palette && palette.text,
            )}
          >
            {open ? (
              <Minus className="h-3 w-3" aria-hidden />
            ) : (
              <Plus className="h-3 w-3" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
      {open && node.children.length > 0 ? (
        <ul>
          {node.children.map((c, i) => (
            <ChartNode
              key={c.id}
              node={c}
              tone={childTone(i)}
              selectedId={selectedId}
              onSelect={onSelect}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Đường từ gốc tới node (để hiện "Ban giám đốc › Kho › Thủ kho"); [] nếu không thấy. */
export function pathTo(roots: OrgDepartmentNode[], id: string): OrgDepartmentNode[] {
  for (const r of roots) {
    if (r.id === id) return [r];
    const sub = pathTo(r.children, id);
    if (sub.length) return [r, ...sub];
  }
  return [];
}
