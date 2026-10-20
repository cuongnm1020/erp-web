# SCREEN SPEC — `FE-GRN-2-grn-stage-cost` (đã code 2026-10-20)

Sửa ba màn **Phiếu nhập kho** (`/wms/grn`, `/wms/grn/new`, `/wms/grn/[id]`). Backend: api
`feat(receiving)` b933f7f 2026-10-20 — `GoodsReceipt.stage`, `POST /goods-receipts/:id/costs`,
`unitCost` tuỳ chọn khi tạo phiếu.

Thay đổi nghiệp vụ (user chốt 2026-10-20):

- **Kho nhập hàng không cần giá.** Ô "Đơn giá / ĐVT nhập" (và Thành tiền, Tổng giá trị) **chỉ hiện
  cho người có `stock.cost`** (kế toán). Tài khoản kho (`stock.receive`) không thấy tiền trên phiếu.
- **Tiến độ phiếu** (`stage`) thay badge DocStatus: **Mới tạo → Đang cất hàng → Chờ nhập giá →
  Hoàn thành** (+ Đã hủy). Task cất hàng đóng xong → hàng bán được ngay; còn dòng thiếu giá thì
  phiếu "Chờ nhập giá"; kế toán nhập và lưu xong → "Hoàn thành".

---

## 1. Bối cảnh

- **Người dùng:** nhân viên kho (tạo phiếu, cất hàng) · kế toán (nhập giá sau).
- **Việc duy nhất của kế toán ở đây:** vào tab "Chờ nhập giá", mở phiếu, gõ giá từng dòng, Lưu giá.
- **Tần suất:** vài chục phiếu / ngày; nhập giá đi hết bằng bàn phím (Tab giữa các ô).

## 2. Dữ liệu

| Mục | Endpoint | Ghi chú |
|---|---|---|
| Danh sách | `GET /goods-receipts?stage=` | `items[].stage`, `stageCounts{NEW,PUTTING_AWAY,AWAITING_COST,COMPLETED,CANCELLED}` tính trên cùng bộ lọc |
| Chi tiết | `GET /goods-receipts/:id` | `stage`, `putAwayDoneAt`, `costedAt`, `costedByName`, `uncostedLineCount`; `lines[].unitCost` null = chưa có giá; `totalValue` chỉ cộng dòng có giá |
| Tạo phiếu | `POST /goods-receipts` | `lines[].unitCost` **tuỳ chọn**; bỏ trống → không gửi |
| Nhập giá | `POST /goods-receipts/:id/costs` `{ lines: [{ lineId, unitCost }] }` | quyền `stock.cost`; giá theo ĐVT đã nhập của dòng (`uomCode`), server chia `factor`; 409 `RECEIPT_CANCELLED`; trả `stage` mới |

- **Quyền UI:** `ability.can('cost','Stock')` → cột tiền + nút nhập giá; `can('receive','Stock')` → tạo /
  ghi sổ / hủy / nhân bản. Kế toán không có `stock.receive` chỉ thấy nút giá.
- **Không optimistic** (luật 5 — tiền).

## 3. Bố cục (phần thay đổi)

**Danh sách** — thanh lọc, segmented bên phải:

```
[Tất cả 12] [Mới tạo 2] [Đang cất hàng 3] [Chờ nhập giá 4] [Hoàn thành 3] [Đã hủy 0]
```
Cột "Trạng thái" = badge tiến độ (Mới tạo: info · Đang cất hàng: brand · Chờ nhập giá: warn ·
Hoàn thành: ok · Đã hủy: neutral). URL `?stage=`.

**Tạo phiếu** — bảng dòng:

```
# | Sản phẩm | Số lượng · ĐVT nhập | Lô | HSD | [Đơn giá / ĐVT nhập] | [Thành tiền] | ✕
```
Hai cột trong ngoặc chỉ khi `stock.cost`. Cột phải: kế toán thấy "Tổng giá trị"; kho thấy "Số dòng"
+ chú thích "Đơn giá do kế toán nhập sau — cất hàng xong là bán được". Enter ở ô cuối dòng (đơn giá,
hoặc HSD khi không có quyền giá) tạo dòng mới.

**Chi tiết** — header: badge tiến độ + nút theo quyền:

```
[Hủy phiếu] [Nhân bản] [Nhập giá nhập | Sửa giá nhập]            [Ghi sổ phiếu F9]
  — đang nhập giá:  [Bỏ nhập giá] [Lưu giá]
```
Dải đầu trang theo tiến độ: Đang cất hàng (khóa, info) · Chờ nhập giá (warn: "Hàng đã lên kệ, bán
được từ … Còn N dòng chưa có đơn giá") · Hoàn thành (ok, kèm người / lúc nhập giá).
Bảng dòng: cột Đơn giá (kế toán) hiện giá mỗi ĐVT cơ sở + "giá / ĐVT nhập" nếu nhập theo thùng; dòng
chưa giá = chip "Chưa có giá". Chế độ nhập: ô giá theo ĐVT nhập (`/ BOX`), Thành tiền + Tổng giá trị
tính ngay bằng decimal.js. Phiếu "Chờ nhập giá" mở sẵn chế độ nhập cho kế toán.

## 4. Trạng thái & lỗi

- Giá không hợp lệ (không phải số ≥ 0, ≤ 4 số lẻ) → báo đỏ ngay tại dòng, không gọi API.
- Bỏ trống ô = giữ giá cũ / vẫn chưa có giá — không phải lỗi. Không ô nào đổi → toast "Không có giá
  nào thay đổi".
- Lưu xong: toast "Đã lưu giá — phiếu … hoàn thành" (stage COMPLETED) hoặc "Đã lưu giá N dòng — còn M
  dòng chưa có giá".
- 409 `RECEIPT_CANCELLED` / 422 → `messageFor`.

## 5. Ngoài phạm vi

- PDA / trạm cất hàng không đổi: đóng dòng PUT_AWAY cuối là server tự đổi tiến độ.
- Phiếu nhập từ PO (`po-receive-screen`) chưa ẩn cột giá theo quyền — làm khi màn đó được rà.
- Hàng đã bán trước khi có giá: api cập nhật giá vốn lô + phần đã tiêu thụ, worker chốt lại giá vốn
  đơn (`GoodsReceiptCosted`) — web không hiện gì thêm.

## 6. Test

`src/features/wms/grn.test.tsx` — nhóm "Giá nhập theo quyền stock.cost + tiến độ Chờ nhập giá".
