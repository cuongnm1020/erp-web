# SCREEN SPEC — `FE-PANCAKE-WH-1-warehouse-links`

Thêm mục **Kho trên Pancake** vào màn **Kết nối Pancake POS** (`/admin/pancake`), dưới bảng shop.
Backend: api `2d68424` (PANCAKE-WH, 2026-10-14). Phạm vi do người dùng chốt 2026-10-14: chỉ
đồng bộ **danh sách kho + địa chỉ kho**, không đồng bộ tồn kho.

Nghiệp vụ:

- Kho ERP được đẩy lên **mọi shop đang bật**, để sale chọn kho khi lên đơn trên Pancake.
- Đơn về ERP nhận đúng kho sale chọn và giữ hàng ở kho đó. Kho đó thiếu hàng thì đơn vào Sự cố
  thiếu hàng, ERP không tự chuyển kho.
- Kho đã tạo tay trên Pancake mà tên khác kho ERP → admin **nối tay**. Đơn chọn kho Pancake chưa
  nối với kho ERP nào sẽ về kho mặc định ERP.

---

## 1. Bối cảnh

- **Route:** `/admin/pancake` (mục mới dưới bảng shop, trên mục Nhân viên Pancake)
- **Người dùng chính:** quản trị (quyền `sync.config`)
- **Việc duy nhất:** mỗi kho ERP có mặt trên mọi shop, và nối đúng với kho Pancake đang có.
- **Tần suất:** lúc kết nối shop mới, thêm kho mới hoặc khi sale báo chọn kho mà đơn về sai kho.

## 2. Dữ liệu

| Mục | Endpoint | Ghi chú |
|---|---|---|
| Liên kết | `GET /pancake-sync/warehouses/links` | mỗi shop: `warehouses[]` (kho ERP + kho Pancake đã nối), `unlinked[]` (kho Pancake chưa nối), `error` (không đọc được kho của shop) |
| Đẩy toàn bộ | `POST /pancake-sync/push/warehouses` | trả `results[]` (`created/updated/linked/hidden/skipped/failed`), `failed` |
| Nối tay | `PUT /pancake-sync/warehouses/:id/link` `{shopId, externalId}` | 409 `PANCAKE_WAREHOUSE_LINK_TAKEN`, 422 `PANCAKE_WAREHOUSE_NOT_FOUND` |
| Gỡ liên kết | `DELETE /pancake-sync/warehouses/:id/link?shopId=` | 204, không đổi gì trên Pancake |

Không có chứng từ → không cần `Idempotency-Key` (thao tác đẩy / nối là idempotent phía server).

## 3. Bố cục

```
Kho trên Pancake                                         [Đẩy kho lên Pancake]
Kho ERP được đẩy lên mọi shop đang bật để sale chọn kho khi lên đơn…

┌ Shop chính · 407957969 ───────────────────────────────────────────────────┐
│ Kho ERP              │ Kho trên Pancake            │                       │
│ KHO-TT-01 Thạch Thất │ Kho Thạch Thất              │ [Nối kho khác] [Gỡ]   │
│ KHO-LA-01 Long An    │ Chưa có — bấm Đẩy kho…      │ [Nối kho có sẵn]      │
│ KHO-X Ngừng dùng     │ [NGỪNG] … (tắt lên đơn)     │                       │
└───────────────────────────────────────────────────────────────────────────┘
Kho chỉ có trên Pancake (đơn chọn các kho này về kho mặc định ERP): Vật Tư Nông Nghiệp, …
```

- Kho Pancake đã nối mà không còn trên Pancake → badge đỏ "Đã bị xóa trên Pancake".
- Shop không đọc được danh sách kho → dòng cảnh báo "Không đọc được kho của shop — kiểm tra kết nối
  ở bảng trên"; vẫn hiện liên kết đã lưu.
- **Nối kho có sẵn**: dialog chọn một kho trong `unlinked[]` của shop đó → "Nối kho". Thành công
  thì toast "Đã nối kho", kho Pancake nhận tên / địa chỉ của kho ERP.
- **Gỡ liên kết**: ConfirmDialog, nói rõ đơn chọn kho đó sẽ về kho mặc định ERP.
- **Đẩy kho lên Pancake**: chạy ngay, toast "Đã đẩy kho lên Pancake" kèm số kho; có kho lỗi thì
  toast lỗi nêu số kho lỗi.

## 4. Trạng thái

- **loading:** skeleton bảng (3 dòng).
- **empty:** chưa có shop đang bật → EmptyState "Chưa có shop Pancake nào đang bật", không hành động
  thêm (thêm shop ở bảng trên).
- **error:** ErrorState có traceId + Thử lại.
- **success:** bảng theo từng shop như trên.

## 5. Quyền

- Cả mục cần `sync.config` (API trả 403 cho người khác). Nút thao tác bọc `<Can I="config" a="Sync">`.
