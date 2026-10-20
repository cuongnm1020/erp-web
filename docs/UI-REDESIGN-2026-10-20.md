# UI redesign 2026-10-20 — code theo design mới

- Mockup màn: https://claude.ai/artifact/AjDaxhQ4c61MG7axE6fEYL (48 artboard)
- Design system: https://claude.ai/artifact/RwsgPEwCz5QX9hWDjdyW9p
- Nhánh: `feat/ui-redesign-v2` (từ `develop`), chỉ đổi UI, không đụng `apps/api`.

## Nền (primitive)

| Hạng mục | Đổi |
|---|---|
| Token | `primary-hover`, `subtle-foreground`, `*-weak`, `warning-line`, `rounded-chip`, `shadow-popover/dialog`, `max-h-dialog`; bỏ block `.dark` |
| Button | md 32 / sm 28, nút phụ nền card viền input, `danger-ghost`, `loading`+`loadingText`, `shortcut`, `count`, `icon-sm` |
| Input / Select / Textarea | cao 32, nền card, placeholder `subtle-foreground` |
| Checkbox | bo 4px, viền 1.5px `subtle-foreground`, "một phần" nền `secondary` |
| StatusBadge | 18px, bo 9px, chấm màu, nền `*-weak` cố định |
| Dialog | nền card, `shadow-dialog`, cao tối đa màn − 32px cuộn trong, padding 16 |
| DropdownMenuItem | cao 32, `danger`, `hint` (lý do tắt / phím tắt) |
| RowActions | ≤1 nút icon + "⋯"; Xóa/Hủy cuối menu |
| Mới | `BulkActionBar`, `CopyButton`/`Copyable`, `useHotkey`, `PageHeader.status` |

## Quyết định mặc định khi code (user chưa chốt)

- F2 = nút tạo mới chính của màn danh sách; màn Tạo đơn giữ F6/F9/F10.
- Nút icon trên dòng đơn = Xem nhanh. Thiếu hàng ở Tạo đơn: cảnh báo (vàng), không chặn.
- Không gộp Phòng ban với Sơ đồ nhân sự, không đổi tên "Phiếu bán hàng", giữ 2 nút lưu ở chi tiết nhân viên.
- Phiếu giao hàng giữ chip tone, không dùng `flow-*`.
- Ô / cột / nút cần API chưa có: bỏ khỏi code (danh sách dưới).

## Thiếu API (không làm phía web)

_Cập nhật sau khi code xong từng nhóm._
