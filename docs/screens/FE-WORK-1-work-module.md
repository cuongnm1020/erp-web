# SCREEN SPEC — `FE-WORK-1-work-module` (module Công việc)

Module **Công việc**: yêu cầu của khách (YC), yêu cầu nội bộ (YN), giao việc (CV). Plan:
`../../docs/PLAN-ticket-sla.md` §6–§7 (chốt T1–T14 ngày 2026-10-22). Mockup đã dựng (canvas
**AX1fEXmhQ1oc74MU6BBC2B**, design system Thiên Nông ERP) — spec này là bản chữ của canvas, giao
diện theo đúng artboard ghi trong ngoặc. Backend: api `ddfd6ff` … `fe71041` (WK-1 … WK-8).

Thay mock cũ `/crm/tickets` (chuyển hướng sang `/work/queue`).

## Menu

Module **Công việc** ngay sau Tổng quan (chưa có token `mod-work` → dùng màu brand như Tổng quan cho
tới khi design system duyệt token):

| Mục | Route | Quyền (CASL) |
|---|---|---|
| Việc của tôi | `/work` | `read Work` (work.read — mọi vai trò) |
| Việc của team | `/work/team` | `view WorkTeam` (`/auth/me.managesDepartments`) |
| Hàng chờ yêu cầu | `/work/queue` | `read Work` |
| Tạo việc (ẩn khỏi menu) | `/work/new` | `create Work` |
| Chi tiết | `/work/:id` | `read Work` (API 404 nếu ngoài phạm vi) |

Báo cáo › **Công việc & SLA** `/reports/work` (`work Report`). Quản trị › **Cấu hình công việc**
`/admin/work-config` (`config Work`).

## 1. Việc của tôi — `/work` (A1, mẫu Danh sách)

- Tab: **Giao cho tôi** (`view=mine`) · Tôi yêu cầu (`requested`) · Tôi theo dõi (`watching`) · Đã
  xong (`done`). Đếm từ `GET /work-items/counts`.
- Lọc: tìm (mã / tiêu đề / liên hệ), Loại (khách / nội bộ / giao việc), Ưu tiên. URL: `?tab=&q=&kind=&priority=&page=`.
- Ô "Thêm việc cho mình — gõ rồi Enter" + chọn hạn (Hôm nay / Ngày mai / Không hạn) → `POST
  /work-items {kind: TASK}` (Idempotency-Key lúc Enter).
- Bảng: nút tròn "Báo xong" (giao việc có `can.submit`) · Việc (tiêu đề link chi tiết + dòng phụ loại
  · mã · khách / ưu tiên) · Hạn (`deadline`: "Quá 2h 20m" đỏ / "Còn 1h 05m" vàng khi WARNING / "Tạm
  dừng" / "Đúng hạn" + dòng phụ mốc) · Trạng thái (chip) · Nguồn (người giao / phòng nhận) · Tiến độ
  checklist. Mặc định sắp theo hạn đang chạy (API).
- Cột phải: "Hôm nay của tôi" (quá hạn, đến hạn hôm nay, xong hôm nay, chờ duyệt — từ counts.mine),
  "Tôi đang chờ người khác" (3 yêu cầu gần nhất `view=requested`; RESOLVED nội bộ có nút Đã xong /
  Chưa xong), "Nhờ phòng khác" → `/work/new?kind=INTERNAL`.
- PageHeader: "Yêu cầu nội bộ" (phụ) · **Tạo việc · F2** (chính).

## 2. Việc của team — `/work/team` (B1, mẫu Tổng quan + Danh sách)

- Ô chọn phạm vi phòng (workload.departments); KPI: Đang mở, Quá hạn, Đến hạn hôm nay, Chờ tôi duyệt,
  Xin gia hạn (counts.team).
- Hai thẻ: **Chờ tôi duyệt kết quả** (`view=team&status=SUBMITTED&assignerId=me`) — nút Làm lại / Duyệt;
  **Xin gia hạn** (`pendingExtension=true`) — Từ chối / Đồng ý.
- **Khối lượng theo người** (`GET /work-items/workload`): đang làm (thanh), quá hạn, hạn hôm nay, chờ
  duyệt, xong 7 ngày, % đúng hạn 30 ngày (dưới 90% có "↓"), nút Giao việc → `/work/new?assignee=`.
- Danh sách việc đã giao (`view=team`) có chọn nhiều → BulkActionBar "Chuyển việc" (B2 hộp chuyển).

## 3. Hàng chờ yêu cầu — `/work/queue` (C1)

- Tab: Của tôi (`assigneeId=me`) · Chưa nhận (`none`) · Của team · Sắp quá hạn (`due=soon`) · Quá hạn
  (`due=overdue`) · Đã xử lý (`status=RESOLVED`) · Tất cả. Nguồn: Tất cả / Của khách / Nội bộ.
- Lọc: phòng nhận (khi phụ trách nhiều), loại yêu cầu, ưu tiên, tìm.
- Bảng: chọn · Mã · Khách / người yêu cầu · Yêu cầu (+ loại · đơn) · Ưu tiên · Trạng thái · Người xử
  lý (hoặc nút **Nhận**) · SLA · Cập nhật · RowActions.
- BulkActionBar (trưởng phòng): **Giao cho…** (D1 hộp giao), Đổi ưu tiên, Bỏ chọn.

## 4. Chi tiết — `/work/:id` (A2 giao việc, C2 yêu cầu, mẫu Chi tiết)

- PageHeader: tiêu đề + chip trạng thái; dòng phụ mã · loại · ưu tiên · người giao / tạo · kênh. Nút
  theo `can` (API trả sẵn), tối đa 3 nút hiện + "⋯":
  - Yêu cầu: Nhận · Chờ khách / Khách phản hồi · Giao lại · **Đã xử lý**; ⋯ Đóng, Mở lại, Hủy.
  - YN đã xử lý, người yêu cầu: Chưa xong · **Xác nhận xong**.
  - Giao việc: Xin gia hạn · Bắt đầu · **Báo xong**; người giao: Làm lại · **Duyệt**; ⋯ Chuyển việc, Hủy.
- Dải hạn: 3 ô — hạn (phản hồi đầu / xử lý / hạn chót) + thanh % đã dùng · tiến độ checklist hoặc
  chính sách SLA · sau khi xong / người xử lý. Quá hạn → dải `destructive-weak`.
- Cột chính: Mô tả · Checklist (lọc Chưa xong / Xong, ô tick, thêm mục) · Trao đổi & lịch sử: ô ghi
  (yêu cầu khách: chọn "Phản hồi khách" + kênh | "Ghi chú nội bộ"; còn lại: bình luận), đính kèm,
  dòng thời gian mới nhất trên cùng (REPLY nền thẻ, NOTE nền `info-weak`, sự kiện hệ thống chữ phụ).
- Cột phải 320: Khách (hoặc "Ngoài phạm vi của bạn — liên hệ: …"), Đơn liên quan, Nhờ phòng khác
  (YN con + nút tạo), Thông tin (loại, ưu tiên, kênh, phòng nhận, người làm, người giao, theo dõi,
  hạn, duyệt, lặp lại).
- Trạng thái: đang tải skeleton; 404 "Không có việc này" + về danh sách; cuối (đóng / xong / hủy) →
  dải `info-weak` "Chỉ xem".

## 5. Tạo việc — `/work/new` (A3 giao việc, C3 yêu cầu khách; mẫu Form chứng từ)

- Chọn loại (3 thẻ radio): Giao việc · Yêu cầu nội bộ · Yêu cầu của khách (chỉ hiện khi có
  `create_customer Work`). `?kind=`, `?parentId=` (Nhờ phòng khác: điền sẵn khách / đơn), `?customerId=`,
  `?orderId=`, `?assignee=`.
- Giao việc: tiêu đề, mô tả, người làm (nhiều — `GET /work-items/assignees`), mỗi người một việc / làm
  chung, chia checklist, hạn (Hôm nay 17:30 / Ngày mai 17:30 / +1 tuần / ngày giờ), ưu tiên, nhắc trước
  hạn, checklist (dán nhiều dòng), cần duyệt, người theo dõi, lặp lại (không / hằng ngày / tuần / tháng).
  Cột phải: khối lượng người làm (cảnh báo người có việc quá hạn) + "Sẽ tạo".
- Yêu cầu nội bộ: phòng nhận, loại (lọc INTERNAL), ưu tiên, tiêu đề, mô tả, khách / đơn (tuỳ chọn).
- Yêu cầu khách: SĐT → tra `GET /customer-care/lookup` (khách toàn hệ thống), loại (ô chọn có ghi SLA),
  ưu tiên, kênh, tiêu đề, mô tả, đơn liên quan (bắt buộc với loại cần đơn — nhập mã / chọn), người liên hệ,
  "Tôi tự nhận". Cột phải: SLA dự kiến theo chính sách của loại.
- Gửi: `POST /work-items` + Idempotency-Key sinh lúc bấm; 422 hiện cạnh ô; xong → chi tiết việc đầu.

## 6. Hộp thoại (B2, D1)

Giao yêu cầu (người xử lý theo phòng nhận + số việc đang làm / quá hạn) · Đã xử lý (hướng xử lý, kết
quả bắt buộc, chứng từ liên quan) · Hủy (lý do bắt buộc) · Xin gia hạn (hạn mới + lý do) · Duyệt /
Yêu cầu làm lại (nhận xét, hạn làm lại) · Từ chối gia hạn · Chuyển việc (người nhận, cộng ngày làm
việc, giữ người cũ theo dõi, lý do).

## 7. Cấu hình — `/admin/work-config` (D2, D3)

Tab **Loại yêu cầu** (bảng theo nhóm khách / nội bộ: tên + mã, ưu tiên mặc định, nơi nhận, cần đơn,
SLA mặc định, đang mở, trạng thái; khung sửa bên phải; thêm loại) · Tab **SLA & giờ làm việc** (ma trận
loại × mặc định / Thấp / Thường / Cao / Khẩn — mỗi ô phản hồi + xử lý, ô trống = theo mặc định; giờ làm
việc, ngày lễ, cảnh báo % + tự đóng sau N ngày). Đơn vị ô SLA: phút / giờ / ngày làm việc.

## 8. Báo cáo — `/reports/work` (E1)

Tab Yêu cầu (`/reports/work/requests`): KPI + so kỳ trước, bảng theo loại, theo người, theo hướng
xử lý. Tab Giao việc (`/reports/work/tasks`): KPI (đúng hạn theo hạn đã duyệt + theo hạn gốc, gia hạn,
làm lại), bảng theo người. Lọc khoảng ngày + phòng.

## 9. Điểm vào (E2)

Chi tiết khách: thẻ "Yêu cầu hỗ trợ" (`GET /work-items?customerId=`) + nút Tạo yêu cầu. Chi tiết đơn:
dải "Đơn có yêu cầu đang mở" + nút Tạo yêu cầu (`?orderId=`). Huy hiệu số trên menu Công việc =
`counts.badge`.
