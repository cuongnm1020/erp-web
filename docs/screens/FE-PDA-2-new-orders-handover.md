# SCREEN SPEC — `FE-PDA-2-new-orders-handover`

Sửa màn **Lấy hàng trên trình duyệt PDA** (`/pda/pick`) và **Nhân viên** (`/admin/users`).
Backend: api `55f6d3a`. App PDA cùng luồng: `apps/pda` `87402ec` (P-10, P-11).
**Luồng đầy đủ, điều kiện, mã lỗi: `apps/api/docs/pick-pack-flow.md` — đọc trước khi sửa.**

Chốt với người dùng 2026-10-12:

- Cột **Đơn mới**: đơn chưa ai giữ đã "Gửi sang ĐVVC", đủ tồn; giá trị cao trước; mỗi dòng chỉ mã
  đơn + số SKU + cân nặng. Chọn đơn → hiện tổng cân nặng các đơn đã chọn. Nút **Lấy đơn** nhận cả
  lô — ai gửi trước được; người sau báo lỗi, tải lại, chọn lại.
- Nút **Gộp lượt lấy**: gộp tất cả đơn đang giữ (chưa bắt đầu, chưa thuộc lượt) thành một lượt.
- Lấy xong → **bắt buộc chọn người đóng gói**; mọi đơn đã lấy xong giao cho người đó. Người đóng
  gói = đang hoạt động, có quyền đóng gói, **cùng kho** (Kho làm việc). Đổi người được, đổi là
  chuyển hết.
- Đơn thiếu hàng không hoàn thành pick, không sang đóng gói — chuyển điều phối (làn Ngoại lệ).

---

## 1. `/pda/pick` — màn chờ (phase idle)

Thêm, theo thứ tự trên xuống:

1. **Thanh vàng** khi còn đơn đã lấy xong chưa giao (`GET /pda/handover` → `pending.length > 0`):
   "N đơn đã lấy xong chưa giao người đóng gói" + nút **Chọn người đóng gói** → hộp thoại §3.
2. **Thanh xám** lần giao gần nhất hôm nay (`latest`, `changeable > 0`): "Đã giao N đơn cho X" +
   nút **Đổi người đóng gói** → hộp thoại §3 chế độ đổi.
3. **Nút Gộp lượt lấy · N đơn** (N ≥ 2 việc PICK của tôi `ASSIGNED`, không thuộc lượt) → xác nhận
   → `POST /pda/waves/self-merge {taskIds, idempotencyKey}` → mở lượt vừa gộp.
4. Cột **Đơn mới** (đầu lưới, trước "Việc được giao"):
   - `GET /pda/new-orders?take=200`, làm tươi 30 s.
   - Dòng: checkbox · mã đơn (mono đậm) · "N SKU · X kg". Chạm cả dòng = chọn/bỏ.
   - Không chọn quá `limit − holding` (toast cảnh báo).
   - Chân cột: "Đã chọn N đơn · X kg" (decimal.js) + nút **Lấy N đơn** (h-14).
   - Nút mờ khi chưa chọn hoặc còn đơn chờ giao.
   - 201 → toast "Đã lấy N đơn", bỏ chọn, làm tươi Việc được giao.
   - 409 `PDA_NEW_ORDERS_TAKEN` → toast lỗi (mã đơn từ details), bỏ chọn hết, tải lại.
   - 409 `PDA_HANDOVER_PENDING` → mở hộp thoại giao người.
   - Bốn trạng thái: đang tải / lỗi / trống ("Chưa có đơn mới — đơn hiện khi sale đã Gửi sang
     ĐVVC") / có dữ liệu.

## 2. `/pda/pick` — xong việc (phase done)

- Có dòng thiếu: "Đơn thiếu hàng chuyển điều phối xử lý, không sang đóng gói."
- Không còn việc được giao (Việc được giao rỗng) → nút chính **Chọn người đóng gói** (72 px), phụ
  "Quét đơn kế tiếp".

## 3. Hộp thoại "Giao người đóng gói"

- `GET /pda/handover` + `GET /pda/packers?warehouseId=` (kho của đơn chờ giao / của lần giao).
- Liệt kê mã đơn (tối đa 5 + "+N"), danh sách người đóng gói dạng radio (h-14).
- **Giao N đơn cho X** → `POST /pda/handovers {packerId, idempotencyKey}`; chế độ đổi: ẩn người
  hiện tại, **Chuyển N đơn cho Y** → `POST /pda/handovers/:id/packer`.
- Không có người đóng gói: "Kho chưa có người đóng gói nào được gán kho làm việc — gán ở Quản trị →
  Nhân viên."
- Key idempotency sinh lúc bấm, giữ khi bấm lại cùng người.

## 4. `/admin/users`

- Chi tiết nhân viên: dòng **Kho làm việc** trong khối Thông tin; hộp thoại Sửa thông tin thêm ô
  chọn kho (danh sách `GET /warehouses`, bỏ kho ảo TRANSIT, có lựa chọn "Chưa gán").
- Tạo nhân viên: ô **Kho làm việc** (không bắt buộc).
- PATCH/POST gửi `warehouseId` (null = bỏ gán).

## 5. Mã lỗi mới (lib/error-messages.ts)

`PDA_NEW_ORDERS_TAKEN`, `PDA_NEW_ORDERS_LIMIT`, `PDA_HANDOVER_PENDING`, `PDA_HANDOVER_EMPTY`,
`PDA_INVALID_PACKER`, `PDA_HANDOVER_NOT_YOURS`.
