import { describe, expect, it } from 'vitest';
import type { OrgDepartmentNode } from './api/use-org-tree';
import { defaultCollapsed } from './components/org-chart';

const node = (id: string, children: OrgDepartmentNode[] = []): OrgDepartmentNode =>
  ({ id, name: id, children }) as unknown as OrgDepartmentNode;

/** Công ty → Ban giám đốc → {Real Agri → {Sale, MKT}, Kho → {Thủ kho}, Vận đơn}. */
const TREE = [
  node('cty', [
    node('bgd', [
      node('ra', [node('ra-sale'), node('ra-mkt')]),
      node('kho', [node('kho-tk')]),
      node('vd'),
    ]),
  ]),
];

describe('defaultCollapsed — sơ đồ nhân sự mặc định thu gọn (2026-10-19)', () => {
  it('mở thân (công ty → ban giám đốc), thu gọn các nhánh có con bên dưới', () => {
    expect([...defaultCollapsed(TREE, null)].sort()).toEqual(['kho', 'ra']);
  });

  it('phòng ban đang chọn luôn hiện — mở tổ tiên của nó', () => {
    expect([...defaultCollapsed(TREE, 'ra-sale')].sort()).toEqual(['kho']);
  });

  it('nhiều gốc = tách nhánh ngay cấp 0 → thu gọn mọi gốc có con', () => {
    const roots = [node('a', [node('a1')]), node('b')];
    expect([...defaultCollapsed(roots, null)]).toEqual(['a']);
  });
});
