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
};

const BY_STATUS: Record<number, string> = {
  401: MESSAGES.UNAUTHORIZED!,
  403: MESSAGES.FORBIDDEN!,
  404: MESSAGES.NOT_FOUND!,
  409: MESSAGES.CONFLICT!,
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
