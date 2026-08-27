import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { QueryState } from './query-state';
import { ListSkeleton } from './skeletons';

describe('states', () => {
  it('ErrorState: câu từ bộ dịch (không message thô), traceId, thử lại', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        error={new ApiError(500, 'SERVER_ERROR', 'raw stack trace', undefined, 'abc-123')}
        onRetry={onRetry}
      />,
    );
    expect(screen.queryByText(/raw stack trace/)).not.toBeInTheDocument();
    expect(screen.getByText(/Máy chủ gặp lỗi/)).toBeInTheDocument();
    expect(screen.getByText('abc-123')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState 403 → màn không có quyền, không có nút thử lại', () => {
    render(
      <ErrorState error={new ApiError(403, 'FORBIDDEN', 'x', undefined, 't')} onRetry={vi.fn()} />,
    );
    expect(screen.getByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it('ErrorState với lỗi JS thường → câu chung, không traceId', () => {
    render(<ErrorState error={new Error('oops')} />);
    expect(screen.queryByText('oops')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('EmptyState: tiêu đề + một hành động', () => {
    render(<EmptyState title="Chưa có gì" action={<button>Tạo mới</button>} />);
    expect(screen.getByText('Chưa có gì')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('ListSkeleton có role=status', () => {
    render(<ListSkeleton rows={3} columns={2} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('QueryState chuyển đủ 4 nhánh', () => {
    const base = { refetch: vi.fn() };
    const ui = (q: { data: string[] | undefined; error: unknown; isPending: boolean }) => (
      <QueryState
        query={{ ...q, ...base }}
        skeleton={<span>skeleton</span>}
        isEmpty={(d) => d.length === 0}
        empty={<span>empty</span>}
      >
        {(d) => <span>{d.join(',')}</span>}
      </QueryState>
    );
    const { rerender } = render(ui({ data: undefined, error: null, isPending: true }));
    expect(screen.getByText('skeleton')).toBeInTheDocument();
    rerender(ui({ data: undefined, error: new Error('x'), isPending: false }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(ui({ data: [], error: null, isPending: false }));
    expect(screen.getByText('empty')).toBeInTheDocument();
    rerender(ui({ data: ['a', 'b'], error: null, isPending: false }));
    expect(screen.getByText('a,b')).toBeInTheDocument();
  });
});
