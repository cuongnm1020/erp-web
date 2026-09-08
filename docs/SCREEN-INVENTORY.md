# Screen Inventory — Portal CRM / CSKH (`apps/web`)

Phạm vi: module `crm` của hệ ERP. Không bao gồm màn kho (WMS), PDA, hay kế toán —
những phần đó nằm ở portal riêng dù dùng chung shell.

**Ưu tiên:** `P1` = bắt buộc để đi live. `P2` = sau khi live, trong 3 tháng đầu. `P3` = khi có nhu cầu thật.
**Khó:** `●` = màn hình có rủi ro cao hoặc nghiệp vụ phức tạp, cần spec kỹ và người thật ngồi cùng.

Tổng: **58 màn hình**, trong đó 27 màn P1.

---

## A. Nền tảng & tài khoản — 8 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| A-01 | `/login` | Đăng nhập | tất cả | P1 | FE-0 |
| A-02 | `/forgot-password`, `/reset-password` | Quên & đặt lại mật khẩu | tất cả | P1 | FE-0 |
| A-03 | `/403` | Không có quyền truy cập | tất cả | P1 | FE-0 |
| A-04 | `/404`, `/500` | Không tìm thấy / Lỗi hệ thống | tất cả | P1 | FE-0 |
| A-05 | `/me` | Hồ sơ cá nhân, đổi mật khẩu | tất cả | P1 | FE-0 |
| A-06 | `/me/notifications` | Trung tâm thông báo | tất cả | P2 | FE-4 |
| A-07 | — (overlay) | Command palette `Ctrl+K` — nhảy nhanh tới KH/đơn/ticket | sale, CSKH | P2 | FE-0 |
| A-08 | `/me/sessions` | Thiết bị đang đăng nhập, đăng xuất từ xa | tất cả | P3 | — |

---

## B. Khách hàng — 11 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| B-01 | `/crm/customers` | Danh sách khách hàng ● | sale, CSKH, leader | P1 | FE-1 |
| B-02 | `/crm/customers/[id]` | Hồ sơ khách hàng 360 ● | sale, CSKH | P1 | FE-1 |
| B-03 | `/crm/customers/new`, `/[id]/edit` | Tạo / sửa khách hàng | sale, CSKH | P1 | FE-2 |
| B-04 | `/crm/customers/[id]/assign` (dialog) | Gán / chuyển nhân viên phụ trách ● | leader, quản lý | P1 | FE-2 |
| B-05 | `/crm/customers/duplicates` | Phát hiện trùng — danh sách cặp nghi ngờ | CSKH, quản lý | P2 | FE-2 |
| B-06 | `/crm/customers/duplicates/[pairId]` | Gộp trùng, so sánh cạnh nhau ● | quản lý | P2 | FE-2 |
| B-07 | `/crm/customers/import` | Import từ file — 3 bước: tải lên → ánh xạ cột → xem trước lỗi ● | quản lý | P1 | FE-2 |
| B-08 | `/crm/customers/[id]/notes` (tab) | Ghi chú nội bộ theo dòng thời gian | sale, CSKH | P1 | FE-1 |
| B-09 | `/crm/customers/[id]/debt` (tab) | Công nợ khách hàng (đọc từ schema `fin`) | sale, kế toán | P2 | FE-5 |
| B-10 | `/crm/customers/bulk-assign` | Gán hàng loạt theo bộ lọc ● | quản lý | P2 | FE-2 |
| B-11 | `/crm/customers/blacklist` | Danh sách chặn / cảnh báo (bom hàng, tranh chấp) | CSKH, quản lý | P2 | FE-2 |

**Ghi chú B-01/B-02:** đây là cặp màn chứng minh data scope. Làm trước mọi thứ khác.
**Ghi chú B-06:** gộp trùng không hoàn tác được → cần màn xác nhận riêng, ghi audit, và
chỉ mở cho vai trò quản lý. Đừng nhét vào dialog nhỏ.

---

## C. Phân nhóm khách hàng — 4 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| C-01 | `/crm/segments` | Danh sách nhóm khách hàng (tĩnh + động) | marketing, quản lý | P2 | FE-2 |
| C-02 | `/crm/segments/new`, `/[id]/edit` | Trình dựng điều kiện nhóm ● | marketing, quản lý | P2 | FE-2 |
| C-03 | `/crm/segments/[id]` | Thành viên nhóm + số liệu tóm tắt | marketing | P2 | FE-2 |
| C-04 | `/crm/tags` | Quản lý nhãn | quản lý | P2 | FE-6 |

**Ghi chú C-02:** trình dựng điều kiện (sản phẩm đã mua / hành vi / mùa vụ / sự kiện) là màn
kỹ thuật nhất trong nhóm này. Rủi ro thật: người dùng dựng điều kiện quét toàn bộ 17k khách và
làm nghẽn API. Bắt buộc có xem trước số lượng khớp **trước** khi lưu, và giới hạn độ sâu điều kiện.

---

## D. Đơn hàng — 9 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| D-01 | `/crm/orders/new` | **Nhập đơn nhanh** ● — màn quan trọng nhất hệ thống | sale, CSKH | P1 | FE-3 |
| D-02 | `/crm/orders?scope=mine` | Đơn của tôi | sale | P1 | FE-3 |
| D-03 | `/crm/orders` | Tất cả đơn (theo scope quyền) | leader, quản lý | P1 | FE-3 |
| D-04 | `/crm/orders/[id]` | Chi tiết đơn + dòng thời gian trạng thái | tất cả | P1 | FE-3 |
| D-05 | `/crm/orders/[id]` (dialog "Sửa đơn") | Sửa đơn: trạng thái + hãng vận chuyển — PATCH /sales-orders/:id, quyền `sales_order.update`; dòng hàng vẫn đi đường hủy & tạo lại | sale, leader | P1 | FE-3 |
| D-06 | `/crm/orders/[id]/cancel` (dialog) | Hủy đơn — lý do bắt buộc, có thể cần duyệt | sale, leader | P1 | FE-3 |
| D-07 | `/crm/returns/new`, `/crm/returns` | Trả hàng / đổi hàng ● | CSKH | P2 | FE-4 |
| D-08 | `/crm/orders/drafts` | Đơn nháp đang dở | sale | P2 | FE-3 |
| D-09 | `/crm/orders/approvals` | Hàng chờ duyệt (giảm giá vượt hạn mức, công nợ vượt trần) ● | leader | P2 | FE-3 |

**Ghi chú D-01:** ràng buộc thiết kế bắt nguồn từ thực tế — sale đang chat Zalo ở cửa sổ khác,
gõ đơn ở đây. Đi hết bằng bàn phím, không rời tay khỏi bàn phím lần nào. Tự lưu nháp.
Ghi nhận nhân viên tạo đơn hiển thị rõ ràng và không sửa được bằng tay.

**Ghi chú D-05:** ranh giới "sửa được / không sửa được" phải khớp chính xác với `Document` state
machine ở backend. Đừng để frontend cho bấm rồi API từ chối — người dùng mất niềm tin ngay.

---

## E. Ticket & chăm sóc — 10 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| E-01 | `/crm/tickets` | Hàng đợi ticket ● — có cảnh báo SLA theo màu, realtime | CSKH | P1 | FE-4 |
| E-02 | `/crm/tickets/[id]` | Chi tiết ticket: hội thoại, đổi trạng thái, đồng hồ SLA ● | CSKH | P1 | FE-4 |
| E-03 | `/crm/tickets/new` | Tạo ticket thủ công (từ cuộc gọi hotline) | CSKH | P1 | FE-4 |
| E-04 | `/crm/tickets/board` | Bảng phân công theo nhân viên — ai đang tải nặng | leader | P2 | FE-4 |
| E-05 | `/crm/tickets?scope=mine` | Ticket của tôi | CSKH | P1 | FE-4 |
| E-06 | `/survey/[token]` | **Khảo sát CSAT** — màn công khai, không đăng nhập ● | khách hàng | P1 | FE-4 |
| E-07 | `/crm/csat` | Kết quả CSAT: điểm, bình luận, lọc theo nhân viên | leader, quản lý | P2 | FE-5 |
| E-08 | `/crm/care-schedule` | Lịch chăm sóc — việc cần làm hôm nay | sale, CSKH | P2 | FE-4 |
| E-09 | `/crm/campaigns`, `/campaigns/[id]` | Chiến dịch chăm sóc: chọn nhóm, kịch bản, theo dõi ● | marketing | P3 | — |
| E-10 | `/crm/suggestions` | Gợi ý upsell / cross-sell theo khách | sale | P3 | — |

**Ghi chú E-06:** đây là **màn duy nhất người ngoài tổ chức nhìn thấy**. Nó cần thiết kế riêng,
tải nhanh trên 3G, dùng được một tay trên điện thoại, không đăng nhập, token dùng một lần.
Đừng dựng nó bằng AppShell nội bộ.

**Ghi chú E-09/E-10:** phần "automation" trong spec gốc. Để P3 có chủ ý — gợi ý sai còn hại hơn
không gợi ý, và cần dữ liệu lịch sử vài tháng mới đủ tin.

---

## F. Kênh & hội thoại — 4 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| F-01 | `/crm/conversations` | Danh sách hội thoại đồng bộ từ Pancake, gắn với khách hàng | CSKH | P2 | FE-4 |
| F-02 | `/crm/conversations/[id]` | Xem hội thoại + nút tạo đơn / tạo ticket từ hội thoại ● | sale, CSKH | P2 | FE-4 |
| F-03 | `/crm/calls` | Nhật ký cuộc gọi hotline, gắn khách hàng | CSKH | P3 | — |
| F-04 | `/crm/customers/[id]/timeline` (tab) | Dòng thời gian đa kênh của một khách | sale, CSKH | P1 | FE-1 |

**Ghi chú quan trọng:** chat Zalo cá nhân **vẫn nằm ngoài hệ thống** — CRM không dựng inbox Zalo.
F-01/F-02 chỉ phục vụ kênh Facebook qua Pancake API. Đừng để yêu cầu trượt thành "làm luôn chat Zalo".

---

## G. Hóa đơn điện tử — 3 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| G-01 | `/crm/invoices` | Danh sách hóa đơn đã phát hành | kế toán, CSKH | P1 | FE-5 |
| G-02 | `/crm/invoices/issue` (dialog từ đơn) | Phát hành hóa đơn từ đơn hàng ● | kế toán | P1 | FE-5 |
| G-03 | `/crm/invoices/failed` | Hóa đơn phát hành lỗi — xem nguyên nhân, phát hành lại ● | kế toán | P1 | FE-5 |

**Ghi chú G-03:** hay bị bỏ quên rồi trở thành khủng hoảng. Phát hành hóa đơn gọi ra bên thứ ba,
sẽ lỗi, và lỗi phải nhìn thấy được chứ không im lặng. Đây là màn P1 dù trông như màn phụ.

---

## H. Báo cáo — 6 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| H-01 | `/crm/reports/dashboard` | Dashboard CSKH: thời gian phản hồi, đúng hạn, CSAT, doanh thu | leader, quản lý | P1 | FE-5 |
| H-02 | `/crm/reports/staff` | Hiệu suất theo nhân viên / team ● | leader, quản lý | P1 | FE-5 |
| H-03 | `/crm/reports/commission` | Bảng kê hoa hồng theo nhân viên ●● | quản lý, kế toán | P1 | FE-5 |
| H-04 | `/crm/reports/customers` | Tỉ lệ mua lại, CLV, phân bố nhóm | quản lý | P2 | FE-5 |
| H-05 | `/crm/reports/revenue` | Doanh thu CSKH theo kênh / nguồn / thời gian | quản lý, cổ đông | P2 | FE-5 |
| H-06 | `/crm/reports/exports` | Lịch sử xuất file (MISA, họp) — chạy nền, tải về | kế toán | P1 | FE-5 |

**Luật chung cho nhóm H:** mọi con số phải bấm được để xem danh sách bản ghi tạo ra nó.
Con số không truy ngược được là con số không ai tin — và với H-03 thì đó là tranh cãi về lương.

**H-03 là màn nhạy cảm nhất trong toàn hệ thống.** Nó động vào thu nhập của từng người.
Sai một lần là mất niềm tin của cả phòng sale, và niềm tin đó không mua lại được bằng bản vá.
Cần: đối chiếu được với H-02, xem được chi tiết từng đơn cấu thành, và có audit ai xem lúc nào.

---

## I. Quản trị — 13 màn

| # | Route | Màn hình | Cho ai | Ưu tiên | Phase |
|---|---|---|---|---|---|
| I-01 | `/admin/users` | Danh sách người dùng | quản trị | P1 | FE-6 |
| I-02 | `/admin/users/new`, `/[id]` | Tạo / sửa người dùng, gán vai trò & team | quản trị | P1 | FE-6 |
| I-03 | `/admin/teams` | Cơ cấu team / phòng ban ● | quản trị | P1 | FE-6 |
| I-04 | `/admin/roles` | Danh sách vai trò | quản trị | P1 | FE-6 |
| I-05 | `/admin/roles/[id]` | **Ma trận phân quyền** ●● | quản trị | P1 | FE-6 |
| I-06 | `/admin/data-scope` | Cấu hình phạm vi dữ liệu (ai thấy khách của ai) ●● | quản trị | P1 | FE-6 |
| I-07 | `/admin/sla` | Chính sách SLA theo loại ticket / mức ưu tiên | quản trị | P1 | FE-6 |
| I-08 | `/admin/canned-replies` | Mẫu trả lời nhanh | CSKH lead | P2 | FE-4 |
| I-09 | `/admin/integrations` | Kênh tích hợp: Pancake, hóa đơn điện tử, MISA — trạng thái kết nối | quản trị | P1 | FE-6 |
| I-10 | `/admin/integrations/[id]/logs` | Nhật ký đồng bộ, lỗi, chạy lại ● | quản trị | P2 | FE-6 |
| I-11 | `/admin/audit` | Nhật ký audit — ai làm gì lúc nào | quản trị | P1 | FE-6 |
| I-12 | `/admin/doc-numbers` | Cấu hình số chứng từ | quản trị | P2 | FE-6 |
| I-13 | `/admin/customer-fields` | Cấu hình trường tùy chỉnh cho khách hàng | quản trị | P3 | — |

**I-05 và I-06 là hai màn khó nhất của cả portal.** Chúng thể hiện mô hình quyền hai trục
(RBAC action-level + data scope) ra giao diện, và nếu giao diện mô tả sai mô hình thì người quản trị
sẽ cấu hình sai mà không biết. Làm sau cùng — sau khi luật phân quyền đã chạy thật qua 5 phase và
đã ổn định. Trước đó, cấu hình bằng seed script là chấp nhận được.

---

## Đọc ngang bảng này

**27 màn P1.** Với kernel FE-0 tốt, phần lớn màn danh sách/chi tiết tốn 0.5–1 ngày. Nhưng bảy màn
đánh dấu `●●` hoặc có ghi chú riêng (D-01, B-07, E-06, H-03, I-05, I-06, G-03) chiếm phần lớn rủi ro
và nên được tính riêng, không gộp vào ước lượng trung bình.

**Ba cạm bẫy trong danh sách này:**

1. **F-01/F-02 trượt thành "làm inbox Zalo".** Ranh giới đã chốt: chat ở ngoài, CRM nhận đơn.
   Mỗi lần yêu cầu này quay lại, nó kéo theo một hệ thống chat hoàn chỉnh.
2. **H-01 bị làm sớm.** Dashboard trông ấn tượng khi demo nhưng dựng trên dữ liệu chưa chắc chắn
   thì mọi con số đều sai. Nó nằm ở FE-5 có lý do.
3. **G-03 bị coi là màn phụ.** Phát hành hóa đơn gọi ra bên thứ ba và sẽ lỗi. Không có màn này thì
   lỗi im lặng, và phát hiện ra vào cuối kỳ kế toán.
