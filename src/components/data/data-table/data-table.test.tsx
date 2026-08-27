import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table';

interface Row {
  id: string;
  name: string;
  total: string;
}

const columns: ColumnDef<Row, unknown>[] = [
  { id: 'name', accessorKey: 'name', header: 'Tên', meta: { sortable: true } },
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Doanh số',
    meta: { sortable: true, align: 'right' },
  },
];

const make = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `KH ${i}`, total: String(i * 1000) }));

const base = {
  columns,
  getRowId: (r: Row) => r.id,
  page: 1,
  size: 50,
  sort: null,
  onPageChange: vi.fn(),
  onSizeChange: vi.fn(),
  onSortChange: vi.fn(),
};

describe('<DataTable>', () => {
  it('5.000 dòng → virtualize, DOM < 100 hàng nhưng > 0', () => {
    // jsdom không có layout → giả lập offsetHeight/Width (virtual-core đo bằng offset*)
    const h = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
    const w = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
    render(<DataTable {...base} rows={make(5000)} total={5000} />);
    h.mockRestore();
    w.mockRestore();
    const trs = screen.getAllByRole('row');
    expect(trs.length).toBeGreaterThan(1);
    expect(trs.length).toBeLessThan(100);
  });

  it('≤ 200 dòng → render thường', () => {
    render(<DataTable {...base} rows={make(30)} total={30} />);
    expect(screen.getAllByRole('row')).toHaveLength(31);
  });

  it('sort header phát sự kiện none → asc → desc → none', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable {...base} rows={make(3)} total={3} onSortChange={onSortChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sắp xếp theo Tên/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({ id: 'name', desc: false });
    rerender(
      <DataTable
        {...base}
        rows={make(3)}
        total={3}
        sort={{ id: 'name', desc: false }}
        onSortChange={onSortChange}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Tên/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    fireEvent.click(screen.getByRole('button', { name: /Sắp xếp theo Tên/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({ id: 'name', desc: true });
    rerender(
      <DataTable
        {...base}
        rows={make(3)}
        total={3}
        sort={{ id: 'name', desc: true }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sắp xếp theo Tên/ }));
    expect(onSortChange).toHaveBeenLastCalledWith(null);
  });

  it('phân trang: đếm, nút prev/next, callback page', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable {...base} rows={make(50)} total={1234} page={2} onPageChange={onPageChange} />,
    );
    expect(screen.getByText('51–100 / 1.234 dòng')).toBeInTheDocument();
    expect(screen.getByText('Trang 2 / 25')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Trang đầu' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('chọn nhiều dòng + bulk actions', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DataTable
        {...base}
        rows={make(3)}
        total={3}
        selection={{ selected: {}, onChange }}
        bulkActions={(ids) => <button>Gán sale ({ids.length})</button>}
      />,
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    expect(onChange).toHaveBeenCalledWith({ r0: true });
    rerender(
      <DataTable
        {...base}
        rows={make(3)}
        total={3}
        selection={{ selected: { r0: true, r2: true }, onChange }}
        bulkActions={(ids) => <button>Gán sale ({ids.length})</button>}
      />,
    );
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gán sale (2)' })).toBeInTheDocument();
  });

  it('rỗng → dòng "Không có dòng nào"', () => {
    render(<DataTable {...base} rows={[]} total={0} />);
    expect(screen.getAllByText('Không có dòng nào').length).toBeGreaterThan(0);
  });
});
