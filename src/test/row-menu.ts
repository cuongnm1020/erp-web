import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Mở menu "⋯" của dòng thứ `index` (RowActions) rồi bấm mục `item`. Xóa / Hủy không còn là nút
 * icon trên dòng (design system 2026-10-20) nên test phải đi qua menu.
 */
export async function clickRowMenuItem(
  item: string | RegExp,
  { index = 0, container }: { index?: number; container?: HTMLElement } = {},
) {
  const user = userEvent.setup();
  const scope = container ? within(container) : screen;
  const triggers = scope.getAllByRole('button', { name: /^Thao tác khác/ });
  await user.click(triggers[index]!);
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

/** Vị trí của nút "Thao tác khác cho <itemName>" trong các nút "⋯" trên màn — dùng cho `index`. */
export function rowMenuIndex(itemName: string, container?: HTMLElement) {
  const scope = container ? within(container) : screen;
  const triggers = scope.getAllByRole('button', { name: /^Thao tác khác/ });
  const index = triggers.findIndex(
    (t) => t.getAttribute('aria-label') === `Thao tác khác cho ${itemName}`,
  );
  if (index < 0) throw new Error(`Không thấy menu "⋯" của ${itemName}`);
  return index;
}
