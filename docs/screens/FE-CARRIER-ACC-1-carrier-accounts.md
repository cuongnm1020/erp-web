# SCREEN SPEC — `FE-CARRIER-ACC-1-carrier-accounts`

Một đơn vị vận chuyển có **nhiều tài khoản** (vd GHTK của hai cửa hàng / hai hợp đồng). Sale chọn
tài khoản khi "Gửi sang ĐVVC". Backend: api `34f51aa` (CARRIER-ACCOUNTS, 2026-10-14). Chốt với
người dùng 2026-10-14: chọn tay trong popup, chọn sẵn tài khoản mặc định; đơn Pancake như đơn
thường (Pancake vẫn chỉ nhận hãng).

Sửa hai màn:

1. **Cấu hình hệ thống › Đơn vị vận chuyển** (`/admin/settings`, mục `CarrierSettingsSection`).
2. **Popup "Gửi sang ĐVVC"** (`SendToCarrierDialog`, mở từ danh sách đơn).

---

## 1. Cấu hình hệ thống › Đơn vị vận chuyển

- **Người dùng:** quản trị (`carrier.config`).
- **Việc duy nhất:** mỗi hãng có đủ tài khoản đang dùng, token đúng, đúng một tài khoản mặc định.

### Dữ liệu

| Mục | Endpoint |
|---|---|
| Danh sách | `GET /carriers/settings` → mỗi hãng `accounts[]` (mặc định trước) |
| Thêm | `POST /carriers/:code/accounts` `{name, …trường}` |
| Sửa / bật tắt | `PATCH /carriers/:code/accounts/:id` `{name?, isActive?, …trường}` |
| Đặt mặc định | `POST /carriers/:code/accounts/:id/default` |
| Kiểm tra kết nối | `POST /carriers/:code/accounts/:id/verify` (luôn 200, kết quả ở `status`) |
| Xóa | `DELETE /carriers/:code/accounts/:id` — 409 `CARRIER_ACCOUNT_IN_USE` khi là mặc định / đã cấp vận đơn |

### Bố cục

```
Đơn vị vận chuyển
┌ Giao Hàng Tiết Kiệm · GHTK ───────────────────────────────── [+ Thêm tài khoản] ┐
│ Tài khoản          │ Thông tin kết nối      │ Kiểm tra kết nối │ Cập nhật │        │
│ Mặc định [Mặc định]│ Token …9f2c (từ env)   │ OK 14/10 08:00   │ —        │ [Kiểm tra] [Sửa]
│ GHTK cửa hàng 2    │ Token …ab12 (nhập ở đây)│ Chưa kiểm tra   │ 14/10    │ [Kiểm tra] [Sửa] [Đặt mặc định] [Tắt] [Xóa]
└────────────────────────────────────────────────────────────────────────────────┘
```

- Tài khoản mặc định: không có nút Tắt / Xóa. Tài khoản đang tắt: badge "Đang tắt", nút "Bật".
- Dialog thêm / sửa: ô **Tên tài khoản** (bắt buộc) + các trường kết nối như trước. Ô trống =
  giữ nguyên. Chỉ tài khoản mặc định có "Dùng lại env"; tài khoản phụ có "Xóa giá trị đã nhập"
  (không có env làm nền, trừ địa chỉ API).
- Lưu xong tự kiểm tra kết nối tài khoản đó (như trước).
- Xóa: ConfirmDialog. Đổi mặc định: chạy ngay, toast "Đã đặt tài khoản mặc định".

### Trạng thái

loading (skeleton bảng) / empty "Chưa có hãng vận chuyển nào kết nối API" / error (traceId) /
success. Không có `carrier.config` → ẩn mọi nút thao tác.

## 2. Popup "Gửi sang ĐVVC"

- Hãng có **từ 2 tài khoản đang bật** → ô **Tài khoản** ở đầu cột Cấu hình, chọn sẵn tài khoản
  mặc định; tài khoản chưa đủ cấu hình hiện mờ "(chưa cấu hình)". Hãng chỉ một tài khoản → không
  hiện ô, gửi không kèm `carrierAccountId` (server dùng mặc định).
- Gửi: `POST /sales-orders/send-to-carrier` thêm `carrierAccountId`.
- Đơn đã có vận đơn ở tài khoản khác → vào danh sách lỗi với câu của mã
  `ORDER_WAYBILL_ACCOUNT_LOCKED` (hủy vận đơn rồi gửi lại).

## 3. Lỗi (lib/error-messages.ts)

`CARRIER_ACCOUNT_NOT_FOUND`, `CARRIER_ACCOUNT_INACTIVE`, `CARRIER_ACCOUNT_IN_USE`,
`CARRIER_ACCOUNT_NAME_TAKEN`, `ORDER_WAYBILL_ACCOUNT_LOCKED`.
