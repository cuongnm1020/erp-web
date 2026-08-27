# Design brief — ERP (WMS + CRM + bán hàng)

Tài liệu cho Claude Design. Đọc phần **Nguyên tắc** và **Persona** trước khi thiết kế bất kỳ màn hình nào.

---

## 1. Đây là phần mềm nghiệp vụ, không phải sản phẩm tiêu dùng

Người dùng ngồi trước màn hình này 8 tiếng/ngày, làm cùng một thao tác hàng trăm lần. Tiêu chí đánh giá là **số thao tác để hoàn thành một việc**, không phải độ đẹp.

**Nguyên tắc bắt buộc:**

- **Mật độ cao.** Bảng hiển thị 25–40 dòng trên một màn hình 1080p. Không padding rộng, không card bo tròn lớn, không khoảng trắng trang trí.
- **Bàn phím trước, chuột sau.** Mọi thao tác lặp lại phải có phím tắt. Form nhập đơn phải điền được trọn vẹn bằng Tab + Enter, không chạm chuột.
- **Không modal cho việc chính.** Modal chỉ dùng cho xác nhận và thao tác phụ. Tạo đơn, sửa đơn, chọn hàng — dùng trang riêng hoặc panel trượt, vì người dùng cần tra cứu song song.
- **Trạng thái luôn hiển thị.** Chứng từ ở trạng thái nào, ai đang giữ, còn chờ ai duyệt — hiện ngay đầu trang, không giấu trong tab.
- **Số liệu căn phải, font đều.** Mọi cột số dùng `font-variant-numeric: tabular-nums`. Tiền tệ không thu gọn (`1.250.000` chứ không `1.25tr`).
- **Không animation.** Ngoại lệ duy nhất: skeleton lúc tải và toast thông báo.
- **Undo thay vì confirm.** Với thao tác đảo ngược được, làm luôn rồi cho hoàn tác trong 10 giây. Confirm dialog chỉ cho thao tác không đảo ngược được (post chứng từ, hủy đơn).

**Chống mù cảnh báo:** hệ thống này có rất nhiều ràng buộc (hết hàng, vượt hạn mức, chờ duyệt, sai lô). Nếu mọi thứ đều đỏ thì không gì là đỏ. Phân ba mức: chặn (đỏ, không đi tiếp được), cảnh báo (vàng, đi tiếp được nhưng ghi log), thông tin (xám).

---

## 2. Persona và bối cảnh

| Persona | Thiết bị | Bối cảnh | Ưu tiên thiết kế |
|---|---|---|---|
| **Admin / vận hành** | Desktop 1440px+, 2 màn hình | Ngồi bàn, đa nhiệm | Mật độ, filter mạnh, bulk action, export |
| **Sale lên đơn** | Desktop 1440px, đôi khi laptop 1280px | Vừa nghe điện thoại vừa nhập | Tốc độ nhập, tìm SKU nhanh, không rời bàn phím |
| **Sale CSKH** | Desktop | Nhiều khách một lúc, cần lịch sử | Timeline hoạt động, ngữ cảnh đầy đủ trong một màn |
| **Quản lý kho** | Desktop | Giám sát, chia đơn cho nhân viên | Dashboard realtime, kéo-thả gán việc |
| **Nhân viên kho** | **PDA Android 5–6", cầm một tay** | Đứng, đi lại, **đeo găng**, kho sáng chói hoặc tối | Nút cực lớn, chữ lớn, tương phản cao, một việc một màn |
| **Kế toán** | Desktop | Đối soát, kỳ khóa sổ | Bảng nhiều cột, drill-down, in ấn |

**PDA là thiết kế riêng biệt, không phải web thu nhỏ.** Xem mục 6.

---

## 3. Design system

### Màu

Nền sáng, không dark mode ở v1 (kho sáng, văn phòng sáng).

```
--bg-page      #F7F8FA   nền trang
--bg-surface   #FFFFFF   bảng, panel, card
--bg-muted     #F1F3F5   header bảng, dòng chẵn
--border       #E1E4E8   viền mặc định, 1px
--border-strong #C9CED6  viền input, focus

--text-primary   #1A1D21
--text-secondary #5B6470
--text-muted     #8A929E

--brand        #1F5FA8   hành động chính, link
--brand-weak   #E8F0F9

--danger       #C0392B   chặn, lỗi, tồn âm
--danger-weak  #FDECEA
--warning      #B7791F   cảnh báo, chờ duyệt, sắp hết hạn
--warning-weak #FEF6E7
--success      #217A4B   hoàn thành, đã post
--success-weak #E8F5EE
--info         #4A5568   trung tính, nháp
--info-weak    #EDF0F3
```

### Typography

- Font: Inter hoặc system sans. Số dùng `tabular-nums`.
- 12px: chú thích, nhãn bảng · 13px: **mặc định trong bảng và form** · 14px: nội dung chính · 16px: tiêu đề mục · 20px: tiêu đề trang
- Chỉ hai độ đậm: 400 và 600.
- Tuyệt đối không dùng chữ dưới 12px trên web, dưới 16px trên PDA.

### Spacing

Thang 4px. Padding ô bảng `6px 10px`. Khoảng cách giữa nhóm form `16px`. Lề trang `20px`.

### Component cần có

Bảng dữ liệu (sắp xếp, ghim cột, chọn nhiều, phân trang server) · Ô nhập có gợi ý (tìm SKU, khách hàng) · Chip trạng thái · Bộ lọc dạng thanh ngang có lưu preset · Panel trượt phải · Form chứng từ (header + dòng chi tiết) · Timeline hoạt động · Ô nhập số lượng có bước tăng/giảm · Bộ chọn ngày và khoảng ngày · Toast + undo · Trạng thái rỗng có gợi ý hành động · Skeleton

### Layout khung

```
┌──────────────────────────────────────────────────┐
│ Thanh trên 48px: logo · tìm kiếm toàn cục · thông báo · user │
├────────┬─────────────────────────────────────────┤
│ Sidebar│ Breadcrumb + tiêu đề + nút hành động     │
│ 200px  ├─────────────────────────────────────────┤
│ thu gọn│ Thanh lọc                                │
│ được   ├─────────────────────────────────────────┤
│ còn    │                                          │
│ 56px   │ Nội dung                                 │
│        │                                          │
└────────┴─────────────────────────────────────────┘
```

Sidebar nhóm theo vai trò, không hiện mục người dùng không có quyền.

---

## 4. Ràng buộc từ hệ thống — ảnh hưởng trực tiếp tới UI

Thiết kế phải phản ánh đúng những điều này, nếu không sẽ vẽ ra màn hình không build được:

1. **Phân quyền dữ liệu:** sale member chỉ thấy khách hàng được leader phân cho mình. Khách của người khác **không hiện trong danh sách** — không phải hiện rồi báo "không có quyền". Không có màn hình nào cho member duyệt toàn bộ khách của team.
2. **Chứng từ đã POST là bất biến.** Màn hình chi tiết chứng từ đã post: mọi trường ở chế độ chỉ đọc, nút duy nhất là "Tạo phiếu điều chỉnh" hoặc "Hủy". Không có nút Sửa.
3. **Tồn kho có 3 con số khác nhau**, phải hiện đủ, đừng gộp: `Tồn thực` (on hand) · `Đang giữ` (reserved) · `Khả dụng` (available = on hand − reserved). Sale nhìn "khả dụng", kho nhìn "tồn thực".
4. **Reserve xảy ra lúc tạo đơn, trừ tồn xảy ra lúc pick.** Màn hình đơn hàng phải phân biệt được hai trạng thái này.
5. **Một SKU có nhiều barcode** (thùng, lẻ, mã NCC). Ô nhập SKU phải tìm được bằng cả mã SKU, tên, và mọi barcode.
6. **Đơn vị tính có quy đổi.** Ô nhập số lượng luôn kèm dropdown đơn vị, và hiển thị quy đổi ra đơn vị cơ bản ngay bên cạnh.
7. **Lô + hạn dùng theo FEFO.** Màn pick hiện lô hệ thống chỉ định; nếu nhân viên quét lô khác → cảnh báo vàng, cho phép ghi lý do, không chặn cứng.
8. **Chờ duyệt là trạng thái thật.** Vượt trần chiết khấu hoặc vượt ngưỡng giá trị → đơn vào PENDING_APPROVAL. UI phải cho thấy đang chờ ai.
9. **Số chứng từ do server cấp lúc lưu.** Màn tạo mới hiện "(tự động)", không cho nhập tay.

---

## 5. Screen inventory

Ưu tiên: **P1** = làm trước, cần cho luồng chạy được · **P2** = làm sau · **P3** = mở rộng.

### A. Nền tảng & quản trị

| Màn hình | Ưu tiên |
|---|---|
| Đăng nhập · quên mật khẩu · đổi mật khẩu | P1 |
| Dashboard tổng quan (theo vai trò) | P1 |
| Danh sách nhân viên · chi tiết nhân viên | P1 |
| Phòng ban · nhóm/team + gán thành viên, chỉ định leader | P1 |
| Vai trò & quyền (ma trận role × permission) | P1 |
| Liên kết tài khoản kho ↔ thiết bị PDA | P1 |
| Nhật ký hoạt động (audit log) có bộ lọc | P2 |
| Cấu hình hệ thống · dải số chứng từ · kỳ kế toán | P2 |
| Quy tắc duyệt (approval rule builder) | P2 |
| Trung tâm thông báo + cấu hình kênh (email/SMS/Zalo/in-app) | P2 |
| Import/Export · migration dữ liệu đầu kỳ (upload → map cột → xem trước → chạy → báo lỗi từng dòng) | P2 |
| Quản lý webhook & tích hợp · nhật ký hàng đợi | P3 |

### B. Sản phẩm & danh mục

| Màn hình | Ưu tiên |
|---|---|
| Danh sách sản phẩm (mật độ cao, lọc theo danh mục/thương hiệu/tồn) | P1 |
| Chi tiết sản phẩm: thông tin · biến thể (variant) · thuộc tính · barcode · đơn vị & quy đổi · tồn theo kho | P1 |
| Tạo/sửa sản phẩm có biến thể (ma trận sinh variant) | P1 |
| Danh mục sản phẩm (cây) · thương hiệu | P2 |
| Quản lý barcode (in tem hàng loạt) | P2 |
| Danh sách lô + hạn sử dụng · cảnh báo sắp hết hạn | P2 |
| Nhà cung cấp: danh sách · chi tiết · lịch sử mua | P2 |

### C. Kho hàng

| Màn hình | Ưu tiên |
|---|---|
| Danh sách kho · sơ đồ vị trí/kệ (cây zone→aisle→rack→bin) | P1 |
| Tồn kho tổng hợp (theo SKU) · tồn theo vị trí · tồn theo lô | P1 |
| Phiếu nhập kho: danh sách · tạo · chi tiết | P1 |
| Phiếu xuất kho: danh sách · tạo · chi tiết | P1 |
| **Bảng điều phối task kho** (xem spec mục 7.3) | P1 |
| Chuyển kho / chuyển vị trí | P2 |
| Purchase Order: danh sách · tạo · nhận hàng đối chiếu PO | P2 |
| Kiểm kê: tạo phiếu · nhập kết quả · duyệt chênh lệch | P2 |
| Điều chỉnh tồn (có lý do bắt buộc) | P2 |
| Sổ cái chuyển động tồn (ledger, chỉ đọc, có drill-down) | P2 |
| Hạn mức tồn + điểm đặt hàng lại · cảnh báo dưới ngưỡng | P3 |

### D. Bán hàng & đơn hàng

| Màn hình | Ưu tiên |
|---|---|
| Danh sách đơn hàng (lọc theo trạng thái/kênh/sale/ngày) | P1 |
| **Màn tạo đơn** (xem spec mục 7.1) | P1 |
| Chi tiết đơn: thông tin · dòng hàng · trạng thái kho · vận chuyển · thanh toán · lịch sử | P1 |
| Hàng chờ duyệt (đơn vượt ngưỡng) | P2 |
| Cấu hình đơn vị vận chuyển (GHN/GHTK/VTP/J&T) · đối soát vận đơn | P2 |
| Cấu hình cổng thanh toán (VNPay/MoMo/ZaloPay/COD) · đối soát | P2 |
| Đơn hoàn / RMA | P3 |

### E. Khách hàng & CSKH

| Màn hình | Ưu tiên |
|---|---|
| Danh sách khách hàng (**đã áp scope**) | P1 |
| **Hồ sơ khách hàng 360°** (xem spec mục 7.4) | P1 |
| Tạo/sửa khách hàng · nhiều địa chỉ giao | P1 |
| Phân công khách cho team / cho member (giao diện của leader) | P1 |
| Nhóm khách hàng · cấp độ · tag | P2 |
| Gộp khách trùng theo số điện thoại (so sánh hai bản ghi, chọn giữ) | P2 |
| Ticket CSKH: danh sách · chi tiết · SLA | P2 |
| Quản lý đồng ý nhận marketing (PDPD) | P2 |

### F. Giá & khuyến mãi

| Màn hình | Ưu tiên |
|---|---|
| Bảng giá: danh sách · chi tiết (giá theo SKU + bậc số lượng) · gán cho nhóm KH | P2 |
| Chương trình khuyến mãi: danh sách · trình tạo điều kiện & ưu đãi | P2 |
| Mã giảm giá (sinh hàng loạt, theo dõi lượt dùng) | P2 |
| Tích điểm: quy tắc · lịch sử điểm của khách | P3 |
| Hoa hồng nhân viên: quy tắc · bảng kê theo kỳ | P3 |

### G. Tài chính

| Màn hình | Ưu tiên |
|---|---|
| Hóa đơn: danh sách · chi tiết · phát hành | P2 |
| Thanh toán & cấn trừ công nợ | P2 |
| Công nợ phải thu / phải trả (theo tuổi nợ) | P2 |
| Giá vốn & giá trị tồn kho (drill-down xuống cost layer) | P3 |

### H. PDA (Android, xem mục 6)

| Màn hình | Ưu tiên |
|---|---|
| Đăng nhập (chọn kho, ghi nhớ thiết bị) | P1 |
| Danh sách việc của tôi | P1 |
| **Pick theo vị trí** (xem spec mục 7.2) | P1 |
| Quét xác nhận SKU + số lượng | P1 |
| Đóng gói | P1 |
| Nhận hàng + nhập lô/hạn dùng | P2 |
| Cất hàng (put-away) | P2 |
| Kiểm kê tại kệ | P2 |
| Tra cứu nhanh (quét mã ra thông tin + tồn) | P2 |
| Xử lý ngoại lệ (thiếu hàng, sai vị trí, hỏng) | P2 |

---

## 6. PDA — quy tắc riêng

Nhân viên **đeo găng tay**, cầm máy một tay, tay kia cầm hàng. Kho có chỗ chói nắng, có chỗ tối.

- Vùng chạm tối thiểu **56×56px**. Nút hành động chính chiếm **toàn bộ chiều rộng, cao 72px**, đặt ở **nửa dưới màn hình** (ngón cái với tới).
- Chữ tối thiểu 16px. Số lượng và mã SKU: **24–32px, đậm**.
- Tương phản tối thiểu 7:1. Không dùng màu xám nhạt trên trắng.
- **Một màn hình một việc.** Không tab, không accordion, không cuộn ngang.
- **Quét là hành động chính, không phải gõ.** Ô nhập tay luôn có nhưng nằm dưới, nhỏ hơn.
- Phản hồi ngay khi quét: đúng → xanh + rung ngắn; sai → đỏ + rung dài + không cho đi tiếp.
- **Trạng thái offline hiện thường trực** ở thanh trên: đang online / offline (N việc chờ đồng bộ). Đây là thông tin nhân viên cần tin tưởng.
- Không có nút Quay lại làm mất dữ liệu. Rời màn giữa chừng → lưu nháp cục bộ.

---

## 7. Spec chi tiết — 4 màn hình xương sống

### 7.1 Sale lên đơn

Mục tiêu: nhập xong một đơn 5 dòng trong **dưới 60 giây, không rời bàn phím**.

Bố cục 2 cột: trái 70% (dòng hàng), phải 30% (tổng kết, dính khi cuộn).

**Vùng header** (1 dòng, gọn): khách hàng (ô gợi ý — tìm theo tên/SĐT/mã) · địa chỉ giao (tự điền mặc định, đổi được) · kênh bán · ngày. Số chứng từ hiện "(tự động)".

**Bảng dòng hàng** — cột: `#` · Sản phẩm (ô gợi ý) · ĐVT (dropdown) · SL · Giá niêm yết (chỉ đọc) · CK% · Thành tiền · Khả dụng · [xóa]

- Gõ vào ô Sản phẩm ở dòng cuối → gợi ý hiện ngay. Chọn xong tự nhảy sang ô SL. Enter ở ô SL → tạo dòng mới.
- Ô Sản phẩm tìm được bằng mã SKU, tên, **và mọi barcode**.
- Cột Khả dụng hiện `khả dụng / tồn thực`. Số âm hoặc thiếu → nền đỏ nhạt, hiện ngay dòng nào thiếu.
- CK% vượt trần bảng giá → viền vàng + chú thích "vượt trần, cần duyệt". Không chặn.
- Ô SL hiện quy đổi ra đơn vị cơ bản bên dưới, chữ 12px xám: `2 thùng = 48 cái`.

**Cột phải:** tạm tính · chiết khấu (có nút áp mã) · thuế · phí vận chuyển · **tổng cộng (20px đậm)**. Dưới đó: khuyến mãi đang áp (chip, gỡ được) · cảnh báo hạn mức công nợ (nếu có) · nút **Lưu nháp** và **Xác nhận đơn** (nếu vượt ngưỡng, nút đổi thành "Gửi duyệt").

**Phím tắt:** `Alt+N` dòng mới · `Alt+S` lưu nháp · `Alt+Enter` xác nhận · `Esc` thoát ô gợi ý · `Ctrl+K` tìm toàn cục.

**Trạng thái cần vẽ:** trống (chưa có dòng nào) · đang tìm sản phẩm · có dòng thiếu hàng · chờ duyệt · lỗi lưu.

### 7.2 PDA — pick theo vị trí

Một màn = một dòng cần lấy. Chuỗi màn hình:

```
┌─────────────────────────┐
│ ● Online   Việc 3/12    │  ← thanh trạng thái, 14px
├─────────────────────────┤
│                         │
│      A-03-02-B          │  ← VỊ TRÍ, 32px đậm, giữa
│                         │
│  ┌───────────────────┐  │
│  │  [ảnh SKU 80px]   │  │
│  └───────────────────┘  │
│  Bút bi Thiên Long TL-08│  ← 18px
│  SKU: TL08-BLUE         │  ← 16px, mono
│  Lô: L2608 · HSD 12/26  │  ← 14px, nền vàng nhạt nếu gần hạn
│                         │
│      Cần lấy: 24        │  ← 28px đậm
│                         │
│  ┌───────────────────┐  │
│  │   QUÉT MÃ VẠCH    │  │  ← 72px cao, full width, màu brand
│  └───────────────────┘  │
│    Nhập tay  ·  Bỏ qua  │  ← 16px, link, nằm dưới cùng
└─────────────────────────┘
```

Sau khi quét:
- **Đúng SKU** → viền xanh, rung ngắn, chuyển sang màn nhập số lượng (bàn phím số lớn, mặc định điền sẵn số cần lấy, nút xác nhận 72px).
- **Sai SKU** → toàn màn nhấp đỏ, rung dài, hiện "Sai sản phẩm — cần TL08-BLUE, đã quét TL08-RED", nút duy nhất "Quét lại".
- **Đúng SKU sai lô** → cảnh báo vàng, hiện lô hệ thống chỉ định và lô vừa quét, hai nút: "Quét lại" và "Dùng lô này + ghi lý do".
- **Thiếu hàng tại vị trí** → nút "Báo thiếu", nhập số thực có, tạo ngoại lệ, chuyển việc tiếp.

Cần vẽ thêm: màn hoàn thành cả wave · màn offline (banner cam, "3 việc chờ đồng bộ") · màn đồng bộ lỗi.

### 7.3 Bảng điều phối task kho

Dành cho quản lý kho, desktop, cập nhật realtime.

Bố cục 3 cột kiểu kanban: **Chưa gán** · **Đang làm** · **Hoàn thành hôm nay**. Thẻ task hiển thị: mã task, loại (nhãn màu: nhận/cất/lấy/đóng), số dòng, độ ưu tiên, thời gian chờ.

- Kéo thẻ từ "Chưa gán" thả vào tên nhân viên ở panel phải → gán việc.
- Panel phải: danh sách nhân viên đang online kèm số việc đang giữ và tiến độ. Nhân viên offline hiện xám.
- Thanh trên: bộ đếm realtime — đơn chờ xử lý · task quá hạn · ngoại lệ chưa xử lý (nhấn vào lọc ngay).
- Task quá SLA → viền trái đỏ. Ngoại lệ → biểu tượng cảnh báo, nhấn mở panel xử lý.

Cần vẽ: trạng thái rỗng (hết việc) · lúc cao điểm (60+ thẻ, phải có gom nhóm) · một nhân viên offline giữa chừng (việc của họ về đâu).

### 7.4 Hồ sơ khách hàng 360°

Một màn duy nhất, không bắt CSKH nhảy trang.

- **Đầu trang:** tên · mã · SĐT · cấp độ (chip) · tag · team phụ trách · người phụ trách · nút gọi/Zalo/tạo đơn.
- **Dải chỉ số:** tổng doanh thu · số đơn · giá trị TB/đơn · công nợ hiện tại · lần mua gần nhất.
- **Cột trái (60%):** timeline hoạt động gộp — đơn hàng, cuộc gọi, ticket, ghi chú, thay đổi phân công. Lọc theo loại. Ô nhập ghi chú nhanh ngay đầu timeline.
- **Cột phải (40%):** thẻ địa chỉ giao · thẻ đơn gần đây (5 đơn, nhấn mở) · thẻ ticket đang mở · thẻ công nợ (theo tuổi nợ) · thẻ trạng thái đồng ý marketing.

Cần vẽ: khách mới chưa có lịch sử · khách có công nợ quá hạn (cảnh báo ở đâu) · khách vừa bị chuyển sang team khác.

---

## 8. Trạng thái phải vẽ cho mọi màn hình

Đừng chỉ vẽ trạng thái lý tưởng. Mỗi màn hình cần: đang tải (skeleton, không spinner) · rỗng (kèm gợi ý hành động, không chỉ ghi "Không có dữ liệu") · lỗi tải (kèm nút thử lại) · lỗi lưu (giữ nguyên dữ liệu người dùng đã nhập) · chỉ đọc (do quyền hoặc do chứng từ đã post) · dữ liệu rất nhiều (bảng 500 dòng trông thế nào) · dữ liệu rất dài (tên sản phẩm 80 ký tự cắt ở đâu).

---

## 9. Prompt mẫu cho Claude Design

```
Bối cảnh: ERP nội bộ (WMS + CRM + bán hàng), người dùng chuyên nghiệp
dùng 8 tiếng/ngày. Ưu tiên mật độ thông tin và tốc độ thao tác, không
ưu tiên thẩm mỹ tối giản.

Đọc mục 1 (Nguyên tắc), mục 3 (Design system), mục 4 (Ràng buộc hệ thống)
trong DESIGN-BRIEF.md.

Thiết kế: [tên màn hình]
Persona: [từ mục 2]
Thiết bị: desktop 1440×900   (hoặc: PDA Android 360×740)
Spec: [dán từ mục 7 nếu có]

Yêu cầu:
- Dùng đúng token màu và thang chữ ở mục 3
- Vẽ đủ các trạng thái ở mục 8
- Ghi rõ phím tắt cho mọi hành động lặp lại
- Không dùng modal cho thao tác chính
```

**Thứ tự thiết kế đề xuất:** 7.1 Tạo đơn → 7.2 PDA pick → 7.4 Hồ sơ KH → 7.3 Điều phối kho → danh sách đơn hàng → danh sách sản phẩm → tồn kho. Bốn màn đầu định hình toàn bộ ngôn ngữ thiết kế; các màn còn lại phần lớn là biến thể của mẫu danh sách và mẫu chứng từ đã hình thành từ đó.
