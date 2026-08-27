# Frontend Plan — apps/web (portal CRM / CSKH)

Đầu vào: `DESIGN-BRIEF.md` (nguyên tắc UI, persona, inventory màn hình), `CLAUDE.md` gốc
(luật kiến trúc backend), `apps/web/CLAUDE.md` (luật frontend).

Nguyên tắc xuyên suốt: **làm theo chiều dọc từng luồng nghiệp vụ**, mỗi phase kết thúc bằng một
thứ người dùng thật bấm được. Ngoại lệ duy nhất là FE-0 — không có màn nghiệp vụ nào, và đó là
bình thường. Cắt FE-0 để "ra tính năng nhanh hơn" là trả giá ở mọi màn hình về sau, y hệt Phase 0
của backend.

---

## FE-0 — Shared kernel (không có màn nghiệp vụ)

Mục tiêu: sau phase này, dựng một màn hình danh sách mới tốn nửa ngày thay vì ba ngày.

| Task | Nội dung | Done khi |
|---|---|---|
| FE-0-01 ⛔ | Khởi tạo `apps/web`: Next.js App Router, TS strict, ESLint/Prettier dùng chung root, Tailwind + token từ DESIGN-BRIEF | `pnpm --filter web dev` chạy, trang `/` render shell rỗng, `typecheck` sạch |
| FE-0-02 ⛔ | `lib/env.ts` validate biến môi trường bằng zod, fail-fast lúc boot | Thiếu `NEXT_PUBLIC_API_URL` → app không khởi động, báo rõ tên biến |
| FE-0-03 ⛔ | API client: `gen:api` từ Swagger, wrapper fetch có interceptor 401 single-flight, gắn `Idempotency-Key`, parse error envelope | Gọi endpoint `/health` qua client sinh sẵn, type-safe; mock 401 → refresh đúng một lần dù có 5 request song song |
| FE-0-04 ⛔ | Auth: đăng nhập, cookie httpOnly, middleware bảo vệ route, trang 403 riêng | Vào route cần quyền khi chưa đăng nhập → về `/login`; đăng nhập rồi mà thiếu quyền → trang 403, không loop redirect |
| FE-0-05 ⛔ | Permission: build CASL ability từ `/auth/me`, `<Can>` component, hook `useAbility()` | Nút bị ẩn đúng theo ability giả lập trong test |
| FE-0-06 | AppShell: sidebar theo module + quyền, breadcrumb, PageHeader, command palette (`Ctrl+K`) | Điều hướng đủ 6 module, mục không có quyền không hiện |
| FE-0-07 ⛔ | `DataTable`: server pagination, sort, filter bar, đồng bộ URL, chọn nhiều dòng, cột sticky, virtualize | Bảng 5.000 dòng giả lập cuộn mượt; F5 giữ nguyên page/sort/filter; dán URL cho máy khác ra đúng kết quả |
| FE-0-08 ⛔ | Form kit: `Form`, `FormField`, `MoneyInput`, `QuantityInput`, `DatePicker`, `EntityPicker` (async search) — tất cả nối zodResolver, map lỗi 422 vào field | Form mẫu nhận lỗi 422 giả lập, cuộn tới field sai đầu tiên |
| FE-0-09 | Trạng thái chuẩn: `<Skeleton>` theo layout, `<EmptyState>`, `<ErrorState>` (có traceId + thử lại), `<Toast>` | Một màn demo chuyển qua đủ 4 trạng thái bằng công tắc |
| FE-0-10 | Format util: `formatMoney`, `formatQuantity`, `formatDate/DateTime`, `formatPhone` + test | Test bao gồm: số âm, số 0, giá trị rất lớn, chuyển múi giờ qua nửa đêm |
| FE-0-11 | Realtime: socket provider, hook `useInvalidateOn(event, keys)` | Bắn event giả → đúng query bị invalidate, không query nào khác bị đụng |
| FE-0-12 | Storybook + test setup (Vitest + Testing Library + MSW) | `pnpm --filter web storybook` chạy, mọi component ở `components/data/` có story đủ 4 trạng thái |

**Gate ra khỏi FE-0:** dựng một màn hình danh sách "throwaway" trên endpoint bất kỳ trong ≤ 4 giờ,
đủ 4 trạng thái, đủ phân trang/URL state, không viết thêm dòng hạ tầng nào. Không đạt thì FE-0 chưa xong.

---

## FE-1 — Luồng đọc: Khách hàng

Chọn làm trước vì nó ép hai thứ khó nhất lộ ra sớm: **data scope** và **bảng lớn thật**.

- **FE-1-01 Danh sách khách hàng.** Filter: nhân viên phụ trách, team, nhóm KH, kênh nguồn,
  lần mua gần nhất, trạng thái. Cột: tên, liên hệ, sale phụ trách, tổng đơn, doanh số, lần tương tác cuối.
  Hành động hàng loạt: gán sale, gắn nhãn, xuất file.
- **FE-1-02 Hồ sơ khách hàng 360.** Panel trái thông tin định danh; tab: dòng thời gian tương tác,
  đơn hàng, ticket, công nợ, ghi chú nội bộ. Spec chi tiết đã có trong `DESIGN-BRIEF.md`.
- **FE-1-03 Xuất danh sách** (chạy nền, thông báo khi xong — không block UI).

**Acceptance quan trọng:** đăng nhập bằng tài khoản sale thường → chỉ thấy khách của mình;
tài khoản leader → thấy cả team; đổi filter sang sale khác không "lộ" được dữ liệu.
Test này phải chạy bằng tài khoản thật gọi API thật, không mock.

**Gate:** một sale thật dùng màn danh sách trong một buổi làm việc và tìm được khách nhanh hơn Pancake.

---

## FE-2 — Luồng ghi: Khách hàng

- **FE-2-01** Tạo / sửa khách hàng (form kit, validate dùng chung schema).
- **FE-2-02** Gán & chuyển nhân viên phụ trách (có lý do, ghi audit — đây là dữ liệu tính hoa hồng).
- **FE-2-03** Phát hiện & gộp trùng: so sánh cạnh nhau, chọn field giữ lại, cảnh báo không thể hoàn tác.
- **FE-2-04** Import từ file: upload → xem trước ánh xạ cột → báo lỗi theo dòng → xác nhận.

**Acceptance:** bấm "Lưu" hai lần liên tiếp (double-click, hoặc mạng chậm rồi retry) chỉ tạo **một**
khách hàng — chứng minh `Idempotency-Key` hoạt động, không phải chỉ nhờ disable nút.

---

## FE-3 — Đơn hàng (giá trị cao nhất, làm khi kernel đã vững)

Đây là màn hình quyết định dự án thành hay bại: sale đang chat Zalo ở cửa sổ khác và gõ đơn ở đây.

- **FE-3-01 Nhập đơn nhanh.** Spec chi tiết đã có trong `DESIGN-BRIEF.md`. Ràng buộc bổ sung:
  đi hết luồng bằng bàn phím, tìm sản phẩm ≤ 150ms cảm nhận, tự lưu nháp, cảnh báo khi rời trang.
- **FE-3-02 Danh sách đơn của tôi** + bộ lọc theo trạng thái, có đếm ở tab.
- **FE-3-03 Chi tiết đơn** + dòng thời gian trạng thái + hành động theo quyền.
- **FE-3-04 Ghi nhận sale tạo đơn** hiển thị rõ ở mọi nơi (đây là cơ sở tính hoa hồng — sai một lần
  là mất niềm tin của cả phòng sale).

**Acceptance:** nhập một đơn 5 dòng sản phẩm trong ≤ 60 giây, không dùng chuột. Đo bằng đồng hồ,
với một sale thật, không phải với người viết code.

---

## FE-4 — Ticket & SLA

- **FE-4-01** Hàng đợi ticket (bảng có màu cảnh báo SLA, realtime).
- **FE-4-02** Chi tiết ticket: hội thoại, mẫu trả lời nhanh, đổi trạng thái, đồng hồ SLA.
- **FE-4-03** Bảng phân công theo nhân viên (tải công việc, ai đang rảnh).
- **FE-4-04** Khảo sát CSAT (màn công khai cho khách, thiết kế riêng — đây là màn duy nhất
  người ngoài tổ chức nhìn thấy).

**Acceptance:** hai người mở cùng một ticket, một người đổi trạng thái → người kia thấy trong ≤ 2s
mà không mất nội dung đang gõ dở.

---

## FE-5 — Báo cáo

- **FE-5-01** Dashboard CSKH: thời gian phản hồi TB, tỉ lệ đúng hạn, CSAT, doanh thu CSKH.
- **FE-5-02** Báo cáo theo nhân viên / team (nối trực tiếp tới hoa hồng — cần chính xác tuyệt đối).
- **FE-5-03** Báo cáo khách hàng: tỉ lệ mua lại, CLV, phân nhóm.
- **FE-5-04** Xuất báo cáo (file cho MISA, file cho họp).

**Luật riêng cho phase này:** mọi con số trên dashboard phải bấm được để xem danh sách bản ghi tạo ra
nó. Con số không truy ngược được là con số không ai tin.

---

## FE-6 — Quản trị & cấu hình

Người dùng, team, vai trò & ma trận quyền, cấu hình SLA, mẫu trả lời nhanh, kênh tích hợp
(Pancake, hóa đơn điện tử), nhật ký audit.

Màn ma trận quyền là màn khó nhất của phase — làm sau cùng, khi luật phân quyền đã ổn định qua 5 phase.

---

## Thứ tự này có lý do

Đọc → ghi → giao dịch → realtime → tổng hợp → cấu hình. Mỗi bậc dựa vào bậc trước:
không thể làm đúng màn nhập đơn nếu chưa chắc về scope quyền ở màn danh sách khách;
không thể làm báo cáo hoa hồng nếu chưa chắc dữ liệu ghi nhận sale ở màn đơn.

Cám dỗ hay gặp là nhảy thẳng vào dashboard vì nó "trông ấn tượng khi demo". Dashboard dựng trên
dữ liệu chưa chắc chắn thì mọi con số đều sai, và sửa sau tốn gấp ba.

---

## Cách giao việc cho Claude Code

Một màn hình = một phiên = một branch `task/FE-xx-<slug>`. Trước mỗi phiên, chuẩn bị
`docs/screens/FE-xx-<slug>.md` theo `SCREEN-SPEC.template.md`.

Prompt mẫu:

```
Đọc apps/web/CLAUDE.md và docs/screens/FE-1-01-danh-sach-khach-hang.md.

Implement màn hình theo đúng spec đó. Ràng buộc:
- Dùng DataTable và form kit có sẵn trong components/data. Không tự viết bảng mới.
- Không thêm dependency.
- Types API lấy từ lib/api/schema.d.ts. Nếu endpoint thiếu field cần thiết, DỪNG và báo,
  đừng tự chế type.
- Đủ 4 trạng thái: loading skeleton, empty, error có traceId, success.
- Viết story cho mọi component mới, đủ 4 trạng thái.

Xong thì chạy pnpm --filter web typecheck && lint && test, tự sửa cho sạch rồi báo lại
danh sách file đã tạo/sửa.
```

**Definition of done** cho mọi màn hình (kiểm trước khi merge):
- [ ] `typecheck` / `lint` / `test` sạch, không `any`, không `console.log`
- [ ] Đủ 4 trạng thái, có story cho từng trạng thái
- [ ] Trạng thái bảng/filter nằm trên URL, F5 giữ nguyên
- [ ] Không có hex màu hay spacing ngoài token
- [ ] Thao tác chính đi được bằng bàn phím
- [ ] Nút ẩn/hiện đúng theo ability, và đã thử với tài khoản quyền thấp
- [ ] Mutation tạo chứng từ có `Idempotency-Key`, đã thử double-click
- [ ] Câu chữ tiếng Việt, tên hành động nhất quán giữa nút và toast

---

## Rủi ro cần canh

1. **Kernel bị cắt.** Triệu chứng: đến FE-3 vẫn còn copy-paste code bảng. Xử lý: dừng, quay lại FE-0.
2. **Frontend lọc dữ liệu thay backend.** Triệu chứng: thấy `.filter(x => x.ownerId === me.id)`
   trong code màn hình. Đây là lỗ hổng, không phải tính năng — sửa ở API.
3. **Màn nhập đơn thiết kế bởi người không bán hàng.** Xử lý: ngồi cạnh một sale xem họ lên đơn
   trên Pancake trước khi viết dòng code đầu tiên của FE-3.
4. **Số liệu hoa hồng lệch.** Đây là rủi ro chính trị, không phải kỹ thuật. Mọi thay đổi liên quan
   tới ghi nhận sale phải có audit và phải đối chiếu được với báo cáo.
