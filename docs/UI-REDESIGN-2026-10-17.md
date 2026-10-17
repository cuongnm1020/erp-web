# Redesign khung + Tổng quan (2026-10-17)

Mockup đã duyệt: https://claude.ai/artifact/XSwWczCUFoL7P6qY36DHtb — nhánh `feat/ui-shell-redesign`.
Chỉ đổi giao diện; không đổi quyền, route, API hay hành vi nghiệp vụ.

## Đã làm

| # mockup | Hạng mục | File |
|---|---|---|
| 1 | Menu trái nền sáng, mỗi module một màu (token `--mod-*`), nhóm mở/đóng nhớ theo người dùng, Kho chia nhóm con Vận hành / Chứng từ / Danh mục kho / Màn PDA, rộng 240 / thu gọn 60 (bấm ô module mở danh sách mục con), dưới 768px thành ngăn kéo mở bằng ☰ | `components/layout/sidebar.tsx`, `lib/navigation.ts` (`tone`, `section`) |
| 2 | Ô chọn kho lên thanh trên, chấm trạng thái | `components/layout/warehouse-switcher.tsx` |
| 3 | Ô tìm nhanh rộng tới 512px, nút phím tắt (hộp thoại), chuông thông báo, avatar + tên + vai trò | `components/layout/app-shell.tsx` |
| 4 | PageHeader dính dưới thanh trên khi cuộn (mọi màn, qua component chung) | `components/layout/page-header.tsx` |
| 5 | Dải "Cần xử lý" 5 ô dẫn vào danh sách đã lọc | `features/dashboard/components/today-widgets.tsx` |
| 6 | Doanh số dạng bảng Hôm nay / Tháng, lãi gộp hôm nay = % doanh thu | `features/dashboard/components/sales-widgets.tsx` |
| 7 | Doanh thu 30 ngày nằm trong thẻ Doanh số | như trên |
| 8 | Giao hàng dạng luồng 4 bước + bảng theo hãng (`byCarrier`); đơn chờ duyệt có cột "Chờ" | `features/dashboard/components/ops-widgets.tsx` |
| 9 | Tổng đơn hôm nay (gồm đơn hủy, theo kho đang chọn, so hôm qua cùng giờ + cả ngày hôm qua) + 5 SP sắp hết | `today-widgets.tsx` |
| — | Font Be Vietnam Pro 400/600, `--warning` #93600F (đạt 4,5:1), bo thẻ 6px / nút 4px | `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts` |

Nguồn số liệu thật đang dùng:
- Tổng đơn hôm nay / hôm qua cùng giờ / cả ngày hôm qua: `GET /sales-orders/flow-counts?from&to` → `total` (tab "Tất cả", gồm đơn hủy), số hủy = `CANCELLED`. Lọc theo `orderDate`.
- Cần xử lý: `flow-counts` (không giới hạn ngày) → `PENDING_APPROVAL`, `WAREHOUSE`; "Chưa gán ĐVVC" = `flow-counts?noCarrier=true` → `WAREHOUSE + PICKING + PACKED`; "SKU cần nhập" = `GET /stock/replenishment` → `alertCount`.
- Sắp hết hàng: `GET /stock/replenishment?onlyAlert=true&take=5` — theo **mức tồn đã đặt** trên sản phẩm (câu hỏi còn mở trong mockup: theo số ngày đủ bán hay điểm đặt hàng → đang theo API có sẵn).

## Chưa có API — đã dựng giao diện, chờ backend

| Ô / tính năng | Hiện tại trên UI | API cần |
|---|---|---|
| Đơn mới theo giờ (hôm nay so hôm qua) | Khung nét đứt "Biểu đồ theo giờ sẽ hiện khi có API…" | Đếm đơn theo giờ VN cho 1 ngày (+ ngày trước), theo kho đang chọn, ví dụ `GET /sales-orders/hourly-counts?date=` |
| Sự cố / hoàn hàng (dải Cần xử lý) | Số "—", nhãn "· chờ API", không link | Đếm sự cố đang mở (đơn thiếu hàng, hãng từ chối, hoàn chưa nhập…) — tab `RETURNED` / `CARRIER_CANCELLED` của flow-counts là lũy kế, không dùng được |
| Doanh số "so hôm qua **cùng giờ**" | Nhãn "so hôm qua" (API so cả ngày hôm qua), mũi tên tô xám | `/reports/sales/summary` nhận `to` dạng datetime hoặc trả thêm kỳ trước cắt cùng giờ |
| Tên người dùng trên thanh trên | Hiện mã nhân viên + vai trò đầu tiên (prop `ShellUser.name` đã sẵn) | `AuthMeDto` thêm `fullName` |
| Chuông thông báo + số chưa đọc | Menu "Thông báo trong ứng dụng đang được làm…", không badge | `/notifications/inbox` cần DTO trong OpenAPI (hiện `Record<string, never>[]`) + đếm chưa đọc |
| Tìm nhanh dữ liệu (đơn, khách, SĐT, SKU) | Ctrl K chỉ tìm màn hình, placeholder "Tìm nhanh màn hình…" | API tìm kiếm chung |
| Lý do chờ duyệt (vượt hạn mức, giảm giá tay, nợ quá hạn) | Bảng đơn chờ duyệt có cột "Chờ", chưa có cột lý do | `SalesOrderListItem` trả lý do chờ duyệt |

## Cố ý không làm (giữ nguyên tính năng)

- Mục "Tồn kho" và "Phân công" vẫn ẩn như trước (ẩn từ 2026-10-04), mockup có hiện — bật lại là đổi tính năng, cần user chốt.
- Nhãn mục menu giữ như cũ ("Danh sách khách hàng", "Lấy hàng (PDA)"…) để command palette / test không đổi.
- Không thêm phím F2 cho "Tạo đơn" (mockup có gợi ý) — chưa có phím tắt này, thêm là tính năng mới.
- Nhãn "Dữ liệu mẫu" cho màn còn mock: chưa thêm.
- Không bật phím `?` toàn cục (trạm đóng gói đang dùng `?` riêng) — mở hộp phím tắt bằng nút trên thanh trên.

## Ghi chú kỹ thuật

- Vẫn cuộn theo cửa sổ: thanh trên `sticky top-0 z-40`, sidebar `sticky h-screen`, PageHeader `sticky top-12 z-40 -mx-5` (tràn lề `p-5` của `<main>`). Ô dính của DataTable là z-30 nên nằm dưới PageHeader.
- Trạng thái menu nhớ ở localStorage: `erp.sidebar.collapsed`, `erp.sidebar.closed-groups`.
- Màu `mod-*` chỉ cho điều hướng / ô icon trang trí, không dùng cho trạng thái nghiệp vụ.
