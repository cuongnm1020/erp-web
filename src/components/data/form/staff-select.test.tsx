import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { matchesVi } from './search-select';
import { StaffMultiSelect } from './staff-multi-select';
import { StaffSelect, type StaffSelectItem } from './staff-select';

const STAFF: StaffSelectItem[] = [
  { id: 'u-hue', fullName: 'Lê Thị Huế', code: 'huelt' },
  { id: 'u-duy', fullName: 'Lê Viết Duy', code: 'duylv' },
  { id: 'u-dung', fullName: 'Đỗ Văn Dũng', code: 'dungdv' },
];

function Harness({ onChange, noneLabel }: { onChange?: (v: string) => void; noneLabel?: string }) {
  const [v, setV] = useState('');
  return (
    <StaffSelect
      aria-label="Trưởng phòng"
      value={v}
      onChange={(next) => {
        setV(next);
        onChange?.(next);
      }}
      staff={STAFF}
      noneLabel={noneLabel}
    />
  );
}

describe('matchesVi', () => {
  it('khớp không dấu, không phân biệt hoa thường, mọi từ', () => {
    expect(matchesVi('Đỗ Văn Dũng dungdv', 'do dung')).toBe(true);
    expect(matchesVi('Lê Thị Huế huelt', 'HUE')).toBe(true);
    expect(matchesVi('Lê Thị Huế huelt', 'hue duy')).toBe(false);
  });
});

describe('StaffSelect', () => {
  it('gõ tên không dấu → lọc → Enter chọn đúng người', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Trưởng phòng' }));
    await user.type(screen.getByPlaceholderText('Tìm theo tên hoặc mã…'), 'dung');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('u-dung');
    expect(screen.getByRole('combobox', { name: 'Trưởng phòng' })).toHaveTextContent('Đỗ Văn Dũng');
  });

  it('tìm theo mã nhân viên; không khớp thì báo "Không có nhân viên khớp"', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Trưởng phòng' }));
    const search = screen.getByPlaceholderText('Tìm theo tên hoặc mã…');

    await user.type(search, 'duylv');
    expect(screen.getByRole('option', { name: 'Lê Viết Duy · duylv' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Huế/ })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('Không có nhân viên khớp')).toBeInTheDocument();
  });

  it('có noneLabel: gõ tìm rồi Enter chọn người khớp, không chọn nhầm dòng "chưa có"', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} noneLabel="— Chưa có nhóm —" />);
    await user.click(screen.getByRole('combobox', { name: 'Trưởng phòng' }));
    await user.type(screen.getByPlaceholderText('Tìm theo tên hoặc mã…'), 'hue');
    expect(screen.queryByRole('option', { name: '— Chưa có nhóm —' })).toBeNull();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('u-hue');
  });

  it('noneLabel: hiện trên ô khi chưa chọn và chọn lại được về rỗng', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} noneLabel="— Chưa có —" />);
    const trigger = screen.getByRole('combobox', { name: 'Trưởng phòng' });
    expect(trigger).toHaveTextContent('— Chưa có —');

    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Lê Thị Huế · huelt' }));
    expect(onChange).toHaveBeenLastCalledWith('u-hue');

    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: '— Chưa có —' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(trigger).toHaveTextContent('— Chưa có —');
  });
});

function MultiHarness({ exclude }: { exclude?: string[] }) {
  const [v, setV] = useState<string[]>(['u-hue']);
  return (
    <>
      <StaffMultiSelect
        value={v}
        onChange={setV}
        staff={STAFF}
        exclude={exclude}
        roleLabel="trưởng phòng"
        addPlaceholder="Thêm trưởng phòng…"
      />
      <output aria-label="Đã chọn">{v.join(',')}</output>
    </>
  );
}

describe('StaffMultiSelect', () => {
  it('thêm bằng ô tìm (ẩn người đã chọn / bị loại), bỏ bằng nút X', async () => {
    const user = userEvent.setup();
    render(<MultiHarness exclude={['u-dung']} />);
    expect(screen.getByText('Lê Thị Huế')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Thêm trưởng phòng' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Lê Viết Duy · duylv',
    ]);
    await user.click(screen.getByRole('option', { name: 'Lê Viết Duy · duylv' }));
    expect(screen.getByLabelText('Đã chọn')).toHaveTextContent('u-hue,u-duy');

    await user.click(screen.getByRole('button', { name: 'Bỏ Lê Thị Huế khỏi trưởng phòng' }));
    expect(screen.getByLabelText('Đã chọn')).toHaveTextContent('u-duy');
  });
});
