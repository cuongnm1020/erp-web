import { ApiError, NETWORK_ERROR } from './api/errors';

/**
 * Bộ dịch lỗi DUY NHẤT (luật 6). Map `code` → câu tiếng Việt: nói chuyện gì xảy ra + làm gì tiếp.
 * Cấm render `serverMessage` thô. Code mới từ backend → thêm vào đây, không fallback ở màn hình.
 */
const MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết. Đăng nhập lại để tiếp tục.',
  INVALID_CREDENTIALS: 'Sai tên đăng nhập hoặc mật khẩu.',
  INVALID_REFRESH_TOKEN: 'Phiên đăng nhập đã hết. Đăng nhập lại để tiếp tục.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu. Có thể đã bị xóa hoặc bạn không có quyền xem.',
  CONFLICT: 'Dữ liệu đã thay đổi ở nơi khác. Tải lại rồi thao tác lại.',
  UNIQUE_VIOLATION: 'Dữ liệu bị trùng với bản ghi đã có. Kiểm tra lại mã hoặc số điện thoại.',
  VALIDATION: 'Một số trường chưa hợp lệ. Kiểm tra các ô được đánh dấu.',
  DB_ERROR: 'Máy chủ gặp lỗi khi lưu dữ liệu. Thử lại; nếu vẫn lỗi, gửi mã truy vết cho IT.',
  SERVER_ERROR: 'Máy chủ gặp lỗi. Thử lại; nếu vẫn lỗi, gửi mã truy vết cho IT.',
  UPSTREAM_INVALID: 'API trả về phản hồi không hợp lệ. Kiểm tra API đang chạy và cấu hình API_URL.',
  BAD_REQUEST: 'Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.',
  // Lên đơn (POST /sales-orders)
  INSUFFICIENT_STOCK: 'Không đủ tồn kho cho sản phẩm trong đơn. Giảm số lượng hoặc bỏ dòng thiếu.',
  DISCOUNT_ABOVE_MAX: 'Chiết khấu vượt trần của bảng giá. Giảm CK% rồi chốt lại.',
  SKU_NOT_SELLABLE: 'Sản phẩm đã ngừng bán. Bỏ dòng này khỏi đơn.',
  UOM_CONVERSION_MISSING: 'Đơn vị tính chưa có quy đổi về đơn vị cơ sở. Chọn đơn vị khác.',
  EMPTY_ORDER: 'Đơn chưa có dòng hàng nào. Thêm ít nhất một sản phẩm.',
  INVALID_ORDER_INPUT: 'Một số trường của đơn chưa hợp lệ. Kiểm tra các ô được đánh dấu.',
  PRICE_NOT_FOUND:
    'Chưa có giá cho sản phẩm này với khách đang chọn. Báo quản lý cập nhật bảng giá.',
  INVALID_STATUS_TRANSITION:
    'Trạng thái chứng từ đã đổi, thao tác này không còn hợp lệ. Tải lại trang.',
  // Phân công khách hàng (P2-04)
  NOT_TEAM_LEADER: 'Chỉ trưởng nhóm của team này mới được phân công. Chọn team bạn đang lead.',
  USER_NOT_IN_TEAM: 'Người được chọn không còn thuộc team này. Tải lại danh sách thành viên.',
  // Lô & hạn dùng (D1/A3 backend)
  RECEIPT_LOT_REQUIRED: 'Sản phẩm theo lô — nhập số lô cho dòng này rồi lưu lại.',
  RECEIPT_LOT_EXPIRY_CONFLICT:
    'Lô này đã có hạn dùng khác với phiếu. Sửa hạn của lô ở màn Lô & hạn dùng nếu hạn cũ sai.',
  RESERVATION_REPOINT_FAILED:
    'Lô vừa nhặt đã bị đơn khác giữ mất. Tải lại nhiệm vụ và nhặt lại theo gợi ý mới.',
};

const BY_STATUS: Record<number, string> = {
  401: MESSAGES.UNAUTHORIZED!,
  403: MESSAGES.FORBIDDEN!,
  404: MESSAGES.NOT_FOUND!,
  409: MESSAGES.CONFLICT!,
  413: 'File quá lớn — ảnh tối đa 5MB.',
  422: MESSAGES.VALIDATION!,
};

export function messageForCode(code: string, status?: number): string {
  return (
    MESSAGES[code] ??
    (status !== undefined ? BY_STATUS[status] : undefined) ??
    (status !== undefined && status >= 500 ? MESSAGES.SERVER_ERROR! : MESSAGES.BAD_REQUEST!)
  );
}

/** Câu hiển thị cho mọi lỗi — ApiError hoặc lỗi JS bất kỳ. Không bao giờ trả message thô. */
export function messageFor(err: unknown): string {
  if (err instanceof ApiError) return messageForCode(err.code, err.status);
  return MESSAGES.SERVER_ERROR!;
}

export function hasMessageFor(code: string): boolean {
  return code in MESSAGES;
}
