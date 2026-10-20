# Áp design system "Thiên Nông ERP" (bản 9, tokens v2) lên apps/web

- Design system: https://claude.ai/artifact/RwsgPEwCz5QX9hWDjdyW9p (bản 9, 2026-10-21)
- Nhánh: `feat/design-system-v9` (từ `develop`), chỉ đổi UI, không đụng `apps/api`.
- Lịch sử: bản áp đầu 2026-10-20 (token v1) bị gỡ cùng ngày (revert f9ea15e); nhánh này khôi phục
  bản đó rồi nâng lên token v2 theo đúng thứ tự ghi ở `project/code-alignment.md`:
  token → Button/Input → chip/dialog → màn.

## Token (v2, ba lớp)

| Hạng mục | Cách làm |
|---|---|
| Nguồn | `design/tokens.json` = bản chép `project/tokens.json` của design system (145 màu, 20 token Component, 2 duration) |
| CSS | `pnpm gen:tokens` → `src/app/tokens.css` (kênh RGB, alias đã giải); `globals.css` chỉ còn font, base, in ấn |
| Tailwind | `tailwind.config.ts` đọc tokens.json: mọi màu semantic/component thành lớp cùng tên; primitive (`neutral-*`…) không sinh lớp; tên shadcn cũ (`accent`, `popover`, `*-foreground`) là alias |
| Kích thước | `h-control` 32 · `h-button-sm` 28 · `h-chip` 18 · `h-checkbox` 16 · `w-checkbox-hit` 40 · `max-w-dialog` 440 · `max-w-dialog-wide` 672 · `w-drawer` 480 · `grid-cols-detail` (140px 1fr) · `w-detail-aside` 320 · `w-search` 280 · `h-menu-item` 32 · `min-w-menu-min` 220 · `min-h-nav-item` 40 · `top-sticky-page-header` 48 · `h-pda-primary` 72 |
| Chuyển động | `duration-color` 0ms (bỏ `transition-colors` trên nút / ô / menu / dòng bảng), `duration-fast` 120ms |
| Kiểm tra | `pnpm lint` chạy `scripts/check-tokens.mjs` (cấm `bg-*/10`, chữ < 12px, hex tự do, `hsl(var(`) và `gen-tokens --check` |

## Nền (primitive)

| Hạng mục | Đổi |
|---|---|
| Button | md 32 / sm 28, nút phụ nền `button-secondary-bg` viền `button-secondary-border` (3:1), `danger-ghost`, `loading`+`loadingText`, `shortcut`, `count`, `icon-sm`; `destructive` hover tối 8 % |
| Input / Select / Textarea | cao 32, viền `control-border` #8A94A6, focus viền `control-border-focus`, nền tắt `control-bg-disabled`, placeholder `subtle-foreground` |
| Checkbox | 16px bo 4px, viền 1.5px `checkbox-border`, "một phần" nền `secondary` |
| StatusBadge | 18px, bo 9px, chấm màu, nền `*-weak` cố định; trạng thái đơn 5 họ `flow-wait/fulfil/ship/done/issue` + `flow-off` qua 11 alias `flow-<trạng thái>` (`features/orders/labels.ts`) |
| Dialog | nền card, lớp phủ `overlay`, `shadow-dialog`, 440px mặc định / `wide` 672px, cao tối đa màn − 32px cuộn trong |
| DropdownMenu | mục 32px, rộng tối thiểu 220, `danger`, `hint`; hover `menu-item-hover` |
| Table | đầu bảng `table-header-bg`, hover `table-row-hover`, dòng chọn `table-row-selected` |
| RowActions | ≤1 nút icon + "⋯"; Xóa/Hủy cuối menu |
| Sidebar | mục cấp 1 `nav-item` 40px; module Kho xanh rêu `mod-wh`, Quản trị = `info` (tự theo token) |
| Mới | `BulkActionBar`, `CopyButton`/`Copyable`, `useHotkey`, `PageHeader.status` |

## Thay thế hàng loạt trong `src/features`

`bg-<trạng thái>/10|15|5` → `bg-<trạng thái>-weak` · `border-<trạng thái>/40–60` → `border-<trạng thái>-line` ·
`bg-primary/5|10` → `bg-secondary` · `bg-flow-*/10` → `bg-flow-*-weak` · `bg-telco-*/15` → `bg-telco-*-weak` ·
`text-[10px]`/`text-[11px]` → `text-xs` · `h-[72px]` → `h-pda-primary` · `grid-cols-[140px_1fr]` → `grid-cols-detail` ·
`<DialogContent className="sm:max-w-md|sm">` → mặc định 440 · `sm:max-w-lg|2xl` → `wide` 672.

## Còn lệch (chưa làm trên nhánh này)

- Hộp thoại rộng hơn 672px (`max-w-3xl`, `max-w-6xl`: gán khách, chuyển danh mục Pancake, gửi sang ĐVVC,
  sản phẩm theo shop): design system nói dùng Drawer `drawer-width` 480 — chưa có component Drawer.
- Viền nhấn `border-primary/40` trên khung gợi ý (điều phối, tồn kho, container): design system
  không có `primary-line`; giữ nguyên, chờ chốt.
- Thanh màu chồng của Theo dõi giao hàng (`bg-primary/50|75`) là biểu đồ, không phải chip — giữ.
- Màn chưa xếp vào 5 mẫu (Danh sách / Chi tiết / Form chứng từ / Ma trận / Tổng quan); BulkActionBar
  chưa thay thanh lọc ở màn Đơn hàng.

## Quyết định mặc định khi code (user chưa chốt)

- F2 = nút tạo mới chính của màn danh sách; màn Tạo đơn giữ F6/F9/F10.
- Nút icon trên dòng đơn = Xem nhanh. Thiếu hàng ở Tạo đơn: cảnh báo (vàng), không chặn.
- Không gộp Phòng ban với Sơ đồ nhân sự, không đổi tên "Phiếu bán hàng", giữ 2 nút lưu ở chi tiết nhân viên.
- Phiếu giao hàng giữ chip tone, không dùng `flow-*`.
