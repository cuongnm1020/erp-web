# apps/web — Luật frontend

Tài liệu này áp dụng cho mọi công việc trong `apps/web`. Luật ở đây **không được vi phạm**;
nếu một yêu cầu buộc phải vi phạm, dừng lại và hỏi, đừng tự ý lách.

Bối cảnh: portal nội bộ cho sale / CSKH / quản lý. Người dùng ngồi cả ngày trên màn hình này,
nhập liệu nhiều, dữ liệu lớn (17k+ khách hàng, ~10k đơn/ngày). Tối ưu cho **tốc độ thao tác và
độ chính xác**, không phải cho ấn tượng thị giác.

---

## Stack chốt — không thay thế, không bổ sung lib mới nếu chưa hỏi

| Vai trò | Lựa chọn |
|---|---|
| Framework | Next.js App Router, TypeScript `strict` |
| Styling | Tailwind + design tokens từ `DESIGN-BRIEF.md` |
| Primitives | shadcn/ui (copy vào `components/ui/`) |
| Server state | TanStack Query v5 |
| Bảng | TanStack Table (+ virtualizer khi > 200 dòng) |
| Form | react-hook-form + zod (`zodResolver`) |
| Phân quyền UI | CASL (`@casl/ability`, `@casl/react`) |
| API types | sinh từ OpenAPI của `apps/api` — **không viết tay** |
| Realtime | socket.io-client |
| UI state cục bộ | `useState` / URL searchParams. Zustand chỉ khi có ≥3 component xa nhau cùng dùng |

Không thêm: axios (dùng client sinh sẵn), moment, lodash toàn bộ, UI kit thứ hai,
state manager cho server data.

---

## 14 luật bất di bất dịch

### 1. `apps/web` không bao giờ chạm database
Cấm import `@prisma/client`, cấm biến `DATABASE_URL`, cấm SQL. Mọi dữ liệu đi qua HTTP tới
`apps/api`. Server Component cũng vậy — nó gọi API, không gọi DB.

### 2. Types API là sinh tự động, không phải viết tay
`pnpm --filter web gen:api` sinh từ Swagger của `apps/api` ra `src/lib/api/schema.d.ts`.
Cấm khai báo lại shape của response. Nếu type thiếu → sửa DTO ở backend rồi generate lại,
không patch ở frontend. CI fail nếu file sinh ra khác với file đã commit.

### 3. Không fetch trong component
Mọi truy cập API nằm trong hook thuộc `features/<module>/api/`. Cấm `fetch()` trong `useEffect`,
cấm gọi API trong event handler mà không qua `useMutation`.

Query key theo thứ tự phễu: `['crm', 'customers', 'list', params]` / `['crm','customers','detail',id]`.
Invalidate theo prefix, không invalidate toàn bộ cache.

### 4. Mọi mutation tạo chứng từ phải có `Idempotency-Key`
UUID sinh **lúc người dùng bấm**, không sinh trong render. Retry dùng lại đúng key đó.
Áp dụng cho: tạo đơn, tạo phiếu, phát hành hóa đơn, tạo ticket, ghi nhận thanh toán.
Disable nút chỉ là lớp phòng thủ thứ hai, không phải lớp thứ nhất.

### 5. Cấm optimistic update cho dữ liệu tiền và tồn
Đơn hàng, tồn kho, công nợ, hóa đơn, commission: chờ server trả rồi mới đổi UI.
Optimistic chỉ được dùng cho: đánh dấu đã đọc, gán/bỏ gán ticket, toggle theo dõi, sắp xếp cá nhân.

### 6. Lỗi đi qua một bộ dịch duy nhất
API trả `{ code, message, details, traceId }`. Frontend map `code` → câu tiếng Việt trong
`lib/error-messages.ts`. **Cấm render `message` thô từ server ra UI.**
Màn hình lỗi 5xx phải hiện `traceId` để đối chiếu với audit log.

Phân biệt đúng:
- `401` → thử refresh một lần, thất bại thì về trang đăng nhập.
- `403` → hiển thị màn "Bạn không có quyền xem mục này", **không** đá về đăng nhập.
- `409` → xung đột nghiệp vụ, hiện nguyên nhân và hành động khắc phục, không retry tự động.
- `422` → map `details[].path` vào `setError` của form, cuộn tới field đầu tiên sai.

### 7. Ẩn UI theo quyền là UX, không phải bảo mật
Ability CASL build một lần từ `GET /auth/me`, giữ trong context. Ẩn nút bằng `<Can I=... a=...>`.
Cấm `if (role === 'admin')` rải rác trong code — chỉ dùng cặp action/subject.
**Cấm lọc dữ liệu ở frontend theo quyền.** Dữ liệu về tay frontend phải đã được API scope sẵn;
nếu thấy bản ghi không nên thấy, đó là bug backend, phải báo chứ không che ở UI.

### 8. Danh sách luôn phân trang phía server, trạng thái nằm trên URL
Cấm tải hết rồi filter ở client. Page/sort/filter/tab đồng bộ vào `searchParams` để F5 giữ nguyên
và dán link cho đồng nghiệp được. Cursor pagination cho danh sách lớn, offset chỉ cho danh mục nhỏ.

### 9. Realtime chỉ được invalidate, không được vá cache
Socket event → `queryClient.invalidateQueries({ queryKey: [...] })`.
Cấm `setQueryData` bằng payload từ socket: payload không đi qua lớp scope quyền của user hiện tại.

### 10. Tiền, số lượng, ngày giờ đi qua util tập trung
- Tiền: API trả **string decimal**. Tính toán bằng `decimal.js`. Cấm `parseFloat`/`Number` cho tiền,
  cấm `+`/`*` trực tiếp trên giá trị tiền.
- Hiển thị tiền: chỉ `formatMoney()`. Cấm `toLocaleString` rải rác.
- Ngày: API trả ISO UTC. Hiển thị theo `Asia/Ho_Chi_Minh` qua `formatDate()` / `formatDateTime()`.
  Cấm `new Date(x).toLocaleDateString()` trực tiếp trong component.
- Số lượng: số nguyên theo đơn vị cơ sở, đổi đơn vị chỉ ở lớp hiển thị.

### 11. Zod schema là nguồn chân lý dùng chung
Schema validate sống ở `src/lib/shared/` (vendored từ `@erp/shared` cũ khi tách repo).
Ràng buộc phải khớp DTO của `apps/api` — đổi luật nghiệp vụ là đổi cả hai repo.
Cấm định nghĩa lại luật validate ở frontend. Nếu frontend cần luật riêng (ví dụ định dạng nhập liệu),
đặt thành `.superRefine` bọc ngoài schema chung, không sửa schema chung.

### 12. Ranh giới thư mục là một chiều
```
app/            → chỉ routing. page.tsx: đọc params, render 1 feature component. Không fetch, không state.
components/ui/  → primitive shadcn. Không biết gì về nghiệp vụ.
components/data/→ DataTable, FilterBar, MoneyInput, StatusBadge, DateRangePicker. Không biết module nào.
components/layout/ → AppShell, Sidebar, PageHeader, Breadcrumb.
features/<mod>/ → api/ (hooks), components/, schema.ts, types.ts.
lib/            → api client, error map, format, permission, env.
```
`components/**` **cấm** import từ `features/**`. `features/a` cấm import trực tiếp từ `features/b`;
nếu cần dùng chung thì nâng lên `components/data/` hoặc `lib/shared`.

### 13. Mỗi màn hình phải có đủ 4 trạng thái
`loading` (skeleton đúng hình dạng nội dung, không phải spinner giữa màn) / `empty` (kèm đúng
một hành động rõ ràng) / `error` (nút thử lại + traceId) / `success`.
Thiếu một trạng thái = màn hình chưa xong, không được đánh dấu hoàn thành.

### 14. Server Component và Client Component không trộn nguồn dữ liệu
Một màn hình lấy dữ liệu từ **một** nơi. RSC dùng cho: layout, shell, danh mục tĩnh, dữ liệu
không đổi trong phiên. Mọi màn hình danh sách/nhập liệu/tương tác là Client Component + TanStack Query.
Cấm màn hình vừa fetch ở RSC vừa refetch ở client cho cùng một dữ liệu.

---

## Auth

Access token nằm trong cookie `httpOnly`, `Secure`, `SameSite=Lax`. Cấm lưu token vào
`localStorage`/`sessionStorage`, cấm đưa token vào biến JS đọc được.
Refresh xử lý ở một chỗ duy nhất trong interceptor của api client; nhiều request 401 đồng thời
phải gộp về một lần refresh (single-flight), không refresh song song.

---

## Ngôn ngữ giao diện

Tiếng Việt, sentence case, động từ chủ động. Đặt tên theo cái người dùng điều khiển, không theo
tên field trong DB: "Nhân viên phụ trách" chứ không phải "Owner ID".

Một hành động giữ nguyên tên xuyên suốt: nút "Lưu thay đổi" → toast "Đã lưu thay đổi".
Nút "Chốt đơn" → toast "Đã chốt đơn". Không đổi từ giữa chừng.

Lỗi không xin lỗi và không mơ hồ: nói **chuyện gì xảy ra** và **làm gì tiếp**.
"Không đủ tồn kho cho 2 sản phẩm. Xem chi tiết" — không phải "Đã có lỗi xảy ra".
Màn hình trống là lời mời hành động, không phải lời than.

---

## Chất lượng nền — không cần nhắc vẫn phải có

- Focus bàn phím nhìn thấy được; luồng nhập đơn đi hết bằng bàn phím, không cần chuột.
- Phím tắt cho thao tác chính của màn hình, hiển thị được bằng `?`.
- Không layout shift khi dữ liệu về (skeleton chiếm đúng chỗ).
- `prefers-reduced-motion` được tôn trọng.
- Chỉ dùng token màu/spacing trong `tailwind.config`. Cấm hex tự do, cấm `p-[13px]`.

---

## Quy tắc làm việc với Claude Code trong repo này

- **Cấm heredoc** (`cat > file <<'EOF'`) để tạo/sửa file — dùng Write/Edit tool.
- Không gộp lệnh bằng `&&`; chạy từng lệnh riêng.
- Một màn hình một phiên, một branch `task/FE-xx-<slug>`.
- Trước khi viết code màn hình: đọc `SCREEN-SPEC` của màn đó. Không có spec thì hỏi, không tự bịa.
- Sau khi xong: `pnpm typecheck && pnpm lint && pnpm test` phải sạch. Không commit khi còn `any`,
  còn `@ts-expect-error` không kèm lý do, hoặc còn `console.log`.

## Lệnh

```bash
pnpm --filter web dev
pnpm --filter web gen:api      # sinh types từ Swagger của apps/api
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web storybook
```

## Chưa quyết định — không tự ý implement

- Cách hiển thị commission cho sale (thấy của mình hay thấy cả team) — chờ chốt chính sách.
- Màn hình hội thoại Zalo: chat vẫn nằm ngoài hệ thống, CRM chỉ nhận đơn. Không dựng inbox Zalo.
- Bố cục dashboard cổ đông — chờ xác nhận chỉ số nào được để lộ.
