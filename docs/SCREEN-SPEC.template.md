# SCREEN SPEC — `FE-xx-<slug>`

Copy file này vào `docs/screens/` cho mỗi màn hình. Không có spec thì không mở phiên Claude Code.
Phần nào chưa quyết được thì ghi vào mục "Chưa chốt" ở cuối, **đừng để trống rồi để Claude tự đoán**.

---

## 1. Bối cảnh

- **Route:** `/crm/...`
- **Người dùng chính:** (sale / CSKH / leader / kế toán)
- **Việc duy nhất màn hình này giải quyết:** một câu.
- **Họ đang làm gì ngay trước khi mở màn này:** (đang chat với khách? vừa nhận cuộc gọi?)
- **Tần suất:** vài lần/ngày hay cả trăm lần/ngày. Quyết định mức độ tối ưu bàn phím.

## 2. Dữ liệu

| Mục | Endpoint | Ghi chú |
|---|---|---|
| Danh sách | `GET /crm/...` | cursor, page size mặc định |
| Chi tiết | `GET /crm/.../:id` | |
| Ghi | `POST/PATCH ...` | cần `Idempotency-Key`? |

- **Scope quyền:** ai thấy được bản ghi nào (do API scope, ghi ở đây để kiểm chứng khi test).
- **Realtime:** event nào invalidate query nào. Ghi "không có" nếu không có.

## 3. Bố cục

ASCII wireframe, đủ để không phải đoán:

```
┌─ PageHeader: <tiêu đề>                    [Hành động chính] ─┐
├─ FilterBar: [ô tìm] [filter A] [filter B]  [Xuất file]      ─┤
├─ DataTable                                                   │
│  cột | cột | cột | cột                        [hành động]    │
└──────────────────────────────────────────────────────────────┘
```

## 4. Bảng (nếu có)

| Cột | Nguồn field | Định dạng | Sort | Sticky |
|---|---|---|---|---|

- **Filter:** tên, kiểu control, giá trị mặc định, có lên URL không.
- **Sort mặc định:**
- **Hành động hàng loạt:** và ai được phép.

## 5. Form (nếu có)

| Field | Kiểu | Bắt buộc | Luật validate (schema nào ở `packages/shared`) |
|---|---|---|---|

- Field nào phụ thuộc field nào.
- Có tự lưu nháp không.
- Cảnh báo khi rời trang có thay đổi chưa lưu: có / không.

## 6. Hành động và quyền

| Hành động | CASL action/subject | Xác nhận trước? | Toast sau khi xong |
|---|---|---|---|

Nhớ: nút và toast dùng cùng một động từ ("Chốt đơn" → "Đã chốt đơn").

## 7. Bốn trạng thái

- **Loading:** skeleton mô tả gì (bao nhiêu dòng giả, giữ chỗ ra sao).
- **Empty:** câu chữ + đúng một hành động mời gọi.
- **Error:** thông điệp theo `code` nào, có nút thử lại, hiện traceId.
- **Không có quyền (403):** câu chữ hiển thị.

## 8. Bàn phím

| Phím | Hành động |
|---|---|

Luồng đi hết bằng bàn phím: mô tả thứ tự tab.

## 9. Acceptance criteria

Viết dạng kiểm chứng được, không viết "hoạt động tốt":

- [ ] Đăng nhập bằng tài khoản `<role>` → chỉ thấy `<phạm vi>`.
- [ ] Đổi filter X rồi F5 → giữ nguyên kết quả.
- [ ] Bấm lưu hai lần → chỉ tạo một bản ghi.
- [ ] Mạng lỗi giữa chừng → hiện ErrorState có traceId, bấm thử lại phục hồi đúng.
- [ ] ...

## 10. Chưa chốt

Liệt kê điều còn mơ hồ. Claude Code phải **dừng và hỏi** khi chạm vào những mục này,
không được tự quyết.

-
