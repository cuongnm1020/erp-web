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
  // Kết nối Pancake (Quản trị › Kết nối Pancake)
  PANCAKE_NOT_CONFIGURED:
    'Shop này chưa có khoá API đang bật. Thêm hoặc bật kết nối ở màn Kết nối Pancake.',
  PANCAKE_VERIFY_FAILED:
    'Pancake không chấp nhận cấu hình này. Xem nguyên nhân ở cột Kiểm tra kết nối rồi sửa khoá hoặc mã shop.',
  PANCAKE_CONFIG_UNREADABLE:
    'Khoá đã lưu không giải mã được vì khoá mã hoá của server đã đổi. Nhập lại khoá API cho shop này.',
  PANCAKE_WEBHOOK_UNAUTHORIZED:
    'Webhook bị từ chối vì secret không khớp. Dán lại secret từ màn Kết nối Pancake vào cấu hình của Pancake.',
  PANCAKE_SECRET_KEY_MISSING:
    'Server chưa có APP_SECRET_KEY để mã hoá khoá API. Báo IT đặt biến môi trường rồi khởi động lại API.',
  // Hãng vận chuyển (tra cước ở màn sửa đơn, vận đơn ở bàn đóng gói)
  CARRIER_WAYBILL_DATA:
    'Đơn chưa có địa chỉ giao đủ tỉnh/thành hoặc chưa có dòng hàng. Chọn địa chỉ giao ở hồ sơ khách rồi thử lại.',
  CARRIER_NOT_CONFIGURED:
    'Hãng này chưa được cấu hình token/điểm lấy hàng trên server. Báo IT đặt biến môi trường CARRIER_*.',
  CARRIER_API_ERROR: 'Hãng vận chuyển không phản hồi hoặc trả lỗi. Thử lại sau ít phút.',
  CARRIER_OPERATION_UNSUPPORTED:
    'Hãng này không hỗ trợ thao tác vừa gọi (tra cước / in nhãn). Chọn hãng khác hoặc làm tay.',
  CARRIER_NOT_FOUND: 'Hãng vận chuyển không tồn tại hoặc đã tắt. Tải lại danh sách hãng.',
  PICKUP_WAREHOUSE_NOT_READY:
    'Kho lấy hàng chưa khai tỉnh/thành, phường/xã hoặc số điện thoại. Khai ở Kho › Kho & vị trí › Sửa kho rồi thử lại.',
  PICKUP_WAREHOUSE_MISSING:
    'Chưa biết lấy hàng ở kho nào. Chọn kho lấy hàng trên đơn hoặc đặt kho mặc định ở Kho & vị trí.',
  CARRIER_NO_WAYBILL: 'Phiếu giao chưa có mã vận đơn. Gán hãng và xin vận đơn trước.',
  SHIPMENT_NO_WAYBILL: 'Phiếu giao chưa có mã vận đơn. Gán hãng và xin vận đơn trước.',
  CARRIER_LABEL_UNAVAILABLE:
    'Hãng chưa đưa nhãn cho vận đơn này. Thử lại sau ít phút hoặc in từ cổng của hãng.',
  // Máy quét PDA / trạm đóng gói (PLAN-barcode-pick-pack)
  PDA_PICK_NEEDS_ASSIGNMENT:
    'Việc pick này chưa được giao cho bạn. Nhờ điều phối gán trên bảng điều phối rồi quét lại.',
  PDA_TASK_ASSIGNED_TO_OTHER:
    'Việc này đang do người khác làm. Hỏi người đó hoặc nhờ điều phối đổi người rồi quét lại.',
  PDA_TASK_NOT_YOURS:
    'Việc này không được giao cho bạn. Quét mã đơn để nhận việc, hoặc nhờ điều phối.',
  PDA_TASK_NOT_WORKABLE:
    'Việc này đã xong, đã hủy hoặc đang chờ xử lý sự cố — không thao tác được nữa.',
  PDA_TASK_LINE_NOT_FOUND: 'Dòng việc không còn tồn tại. Quét lại mã đơn để tải việc mới nhất.',
  PDA_SCAN_WRONG_SKU: 'Quét sai hàng — sản phẩm này không phải dòng đang lấy. Kiểm tra lại kệ.',
  PDA_SCAN_QTY_EXCEEDS_PLANNED:
    'Quét quá số lượng còn lại của dòng. Bỏ bớt hàng hoặc kiểm tra lại số đã quét.',
  PDA_LINE_NOT_FULLY_SCANNED: 'Dòng chưa quét đủ số lượng. Quét đủ rồi mới hoàn thành được.',
  PDA_LINE_WITHOUT_LOCATION:
    'Dòng này chưa có vị trí lấy hàng (thiếu tồn). Điều phối phải xử lý trước.',
  PDA_NO_RESERVATION: 'Không tìm thấy giữ chỗ khớp dòng này. Báo điều phối kiểm tra lại đơn nguồn.',
  PDA_WAVE_SKU_NOT_FOUND: 'Sản phẩm này không có trong lượt hoặc đã lấy đủ. Kiểm tra lại kệ.',
  WAVE_NOT_FOUND: 'Lượt pick không tồn tại. Quét lại mã lượt.',
  INVALID_WAVE_INPUT:
    'Không gộp được lượt: chỉ gộp task lấy hàng cùng kho, chưa ai nhận, chưa thuộc lượt khác.',
  SYNC_ACTOR_NOT_FOUND: 'Tài khoản hệ thống cho đồng bộ chưa được tạo. Báo IT chạy seed dữ liệu.',
  SYNC_ACTOR_MISCONFIGURED: 'Tài khoản hệ thống cho đồng bộ đang sai cấu hình. Báo IT kiểm tra.',
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
