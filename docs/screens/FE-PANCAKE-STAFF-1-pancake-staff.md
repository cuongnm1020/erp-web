# FE-PANCAKE-STAFF-1 — Nhân viên Pancake (`/crm/pancake-staff`)

Ngày: 2026-10-20. Yêu cầu gốc của người dùng: trưởng nhóm kinh doanh cần một màn hình thấy số
nhân viên chốt đơn Pancake **chưa được gắn vào tài khoản thật** để tìm cách xử lý; gắn xong thì
mọi đơn + khách tự chuyển sang người đó; tài khoản tự tạo `pc.*` đã gắn thì xoá mềm, không hiện nữa.

## Người dùng · quyền

| Vai trò | Quyền | Thấy gì / làm gì |
|---|---|---|
| Trưởng nhóm kinh doanh (SALES_LEADER) | `sync.staff_read`, `sync.staff_map` | Xem mọi nhân viên Pancake chưa gắn (không scope — người chưa gắn chưa thuộc phòng nào); gắn vào **nhân sự phòng mình** (API 403 nếu người khác) |
| Quản trị (ADMIN) | như trên + `sync.map` | Gắn vào bất kỳ ai; nút "Dọn tài khoản tự tạo đã khóa" |
| Nhân viên kinh doanh | — | Không có mục menu; mở URL → màn 403 |

Mục menu: Khách hàng → **Nhân viên Pancake** (`ability staff_read / Sync`).

## Nguồn dữ liệu

- `GET /pancake-sync/staff?pending=true|false` → `PancakeStaffDto[]`: `observedName/Phone/Email`,
  `fbId`, `seenRoles`, `shopIds`, `user` (tài khoản đang gắn), `autoCreated`, `orderCount`,
  `customerCount` (đơn / khách đang đứng tên tài khoản tự tạo), `suggestedUser` (tài khoản thật
  trùng email Pancake), `pending`.
- `GET /pancake-sync/staff/candidates?q=` → tài khoản thật được chọn (đã lọc theo quyền).
- `POST /pancake-sync/staff/relink { fbId, userId }` → `absorbed[]` (tài khoản tự tạo đã gộp: số
  đơn, số khách chuyển).
- `POST /pancake-sync/staff/cleanup` (quản trị) → tài khoản `pc.*` đã khoá từ trước được gộp nốt.

## Bố cục

1. **PageHeader** "Nhân viên Pancake" + mô tả; hành động phải: "Dọn tài khoản tự tạo đã khóa"
   (chỉ `sync.map`) → ConfirmDialog → toast tóm tắt.
2. **3 KpiCard** (tính từ danh sách chờ): Chưa có tài khoản thật (kèm số người có gợi ý) · Đơn
   đang treo ở tài khoản tự tạo · Khách đang treo ở tài khoản tự tạo.
3. **Tab** "Chờ xử lý" (mặc định) / "Tất cả" — trên URL `?tab=all` (luật 8).
4. **Bảng** (dùng chung với khối trong Kết nối Pancake): Nhân viên Pancake (tên; SĐT · email ·
   fb) · Vai trò trên đơn · POS · Đơn / khách · Tài khoản ERP (link nếu có `user.read`; badge
   "Tự tạo" / "Chưa gắn" / "Ngừng hoạt động"; dòng gợi ý "Trùng email với …") · hành động
   (`sync.staff_map`): **Gắn theo gợi ý** (khi có `suggestedUser`, mở hộp đã chọn sẵn) ·
   **Gắn tài khoản** (EntityPicker tìm candidates).
5. **Hộp "Gắn tài khoản ERP cho …"**: mô tả nêu rõ N đơn / M khách của tài khoản tự tạo chuyển
   ngay và tài khoản đó bị xoá; nút "Gắn tài khoản" → toast "Đã gắn tài khoản" + tóm tắt.

## 4 trạng thái (luật 13)

- loading: ListSkeleton 3×6; KPI hiện "…".
- empty (tab Chờ xử lý): "Không còn ai chờ gắn tài khoản".
- error: QueryState chuẩn (thử lại + traceId).
- 403: ForbiddenState.

## Không làm

- Không lọc theo phòng ban ở frontend (luật 7) — người chưa gắn chưa có phòng ban.
- Không tự gắn hàng loạt theo gợi ý — mỗi người một chạm, vì gợi ý theo email có thể sai.
