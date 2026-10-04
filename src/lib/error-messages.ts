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
  // Combo sản phẩm (/combos + bung combo khi lên đơn)
  COMBO_COMPONENT_INVALID:
    'Danh sách thành phần chưa hợp lệ: thiếu, trùng SKU, SKU ngừng bán hoặc định mức bằng 0.',
  COMBO_NESTED: 'Không dùng combo làm thành phần của combo khác. Chọn SKU thường.',
  COMBO_EMPTY: 'Combo chưa có thành phần nên chưa bán được. Thêm thành phần ở màn Combo sản phẩm.',
  COMBO_SINGLE_SKU: 'Sản phẩm combo chỉ có một SKU. Sửa thành phần ở màn Combo sản phẩm.',
  COMBO_SKU_NOT_STOCKABLE:
    'Combo không có tồn riêng. Nhập / điều chỉnh tồn trên từng SKU thành phần.',
  // Phân công khách hàng (P2-04)
  NOT_TEAM_LEADER: 'Chỉ trưởng nhóm của team này mới được phân công. Chọn team bạn đang lead.',
  USER_NOT_IN_TEAM: 'Người được chọn không còn thuộc team này. Tải lại danh sách thành viên.',
  // Lô & hạn dùng (D1/A3 backend)
  RECEIPT_LOT_REQUIRED: 'Sản phẩm theo lô — nhập số lô cho dòng này rồi lưu lại.',
  RECEIPT_LOT_EXPIRY_CONFLICT:
    'Lô này đã có hạn dùng khác với phiếu. Sửa hạn của lô ở màn Lô & hạn dùng nếu hạn cũ sai.',
  // Phiếu nhập hàng hoàn (/wms/returns)
  RETURN_QTY_EXCEEDED:
    'SL hoàn vượt phần đã xuất chưa hoàn (có thể vừa có phiếu hoàn khác được post). Tải lại đơn và sửa SL.',
  RETURN_ORDER_NOT_FOUND: 'Không tìm thấy đơn bán này. Kiểm tra lại số đơn.',
  RETURN_ORDER_NOT_RETURNABLE: 'Đơn chưa chốt hoặc đã hủy — không có hàng đã xuất để nhận hoàn.',
  RETURN_INVALID_INPUT:
    'Phiếu hoàn chưa hợp lệ: kiểm tra SL, vị trí nhận lại và các dòng cùng một kho.',
  RETURN_RECEIPT_NOT_FOUND: 'Phiếu nhập hàng hoàn không còn tồn tại. Tải lại danh sách.',
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
    'Hãng này chưa có token hoặc địa chỉ API. Quản trị viên nhập ở Quản trị › Cấu hình hệ thống › Đơn vị vận chuyển.',
  CARRIER_SECRET_KEY_MISSING:
    'Server chưa có APP_SECRET_KEY để mã hoá token hãng. Báo IT đặt biến môi trường rồi khởi động lại API.',
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
  // Đóng pick / đóng gói tay từ màn sửa đơn (POST /sales-orders/:id/fulfil).
  ORDER_NOT_FULFILLABLE: 'Chỉ đóng pick / đóng gói tay được đơn đã duyệt. Duyệt đơn trước.',
  ORDER_CARRIER_REQUIRED:
    'Đơn chưa chọn hãng vận chuyển. Chọn hãng ở ô ĐVVC rồi lưu lại — vận đơn được xin ngay khi đóng gói.',
  PICK_TASK_NOT_READY:
    'Đơn chưa có việc pick và không tự sinh được. Kiểm tra dòng hàng của đơn rồi thử lại.',
  ORDER_IN_WAVE:
    'Đơn đang nằm trong lượt pick gộp. Hoàn tất lượt trên màn quét, không đóng tay từng đơn được.',
  // Hủy đơn (2026-09-28): đơn đã đóng gói thì tồn đã trừ — không hủy chứng từ được.
  ORDER_ALREADY_PACKED:
    'Đơn đã đóng gói, hàng đã trừ kho — không hủy được. Xử lý bằng hoàn hàng / nhập lại kho.',
  SHIPMENT_CANCELLED: 'Phiếu giao này đã hủy theo đơn — không đóng gói / giao hãng được nữa.',
  SHIPMENT_CANCEL_VIA_ORDER: 'Muốn hủy phiếu giao thì hủy đơn bán, không đổi tay trạng thái phiếu.',
  ORDER_PICK_SHORTAGE:
    'Không có dòng nào lấy được — thiếu tồn ở vị trí pick được. Nhập kho hoặc chuyển hàng vào vị trí pick rồi thử lại.',
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
  CONTAINER_SCAN_REJECTED:
    'Thùng này không lấy được cho dòng đang làm — kiểm tra đúng thùng ghi trên phiếu, đúng vị trí, thùng chưa bị việc khác lấy.',
  CONTAINER_NOT_FOUND: 'Mã thùng không tồn tại. Quét lại tem trên thùng.',
  CONTAINER_NOT_OPEN: 'Thùng đã đóng hoặc đã rỗng — không thao tác được.',
  CONTAINER_NOT_EMPTY: 'Thùng còn hàng — không đóng được.',
  CONTAINER_LOCATION_MISMATCH:
    'Thùng không cùng vị trí với thùng cha — chuyển tới vị trí cha trước.',
  CONTAINER_HAS_PARENT:
    'Thùng đang nằm trong thùng cha — thao tác trên thùng cha hoặc tách ra trước.',
  CONTAINER_BARCODE_TAKEN: 'Mã thùng này đã được dùng — nhập mã khác.',
  INVALID_CONTAINER_INPUT: 'Thao tác thùng không hợp lệ. Xem chi tiết.',
  WAVE_NOT_FOUND: 'Lượt pick không tồn tại. Quét lại mã lượt.',
  INVALID_WAVE_INPUT:
    'Không gộp được lượt: chỉ gộp task lấy hàng cùng kho, chưa ai nhận, chưa thuộc lượt khác.',
  WAVE_SUGGESTION_STALE:
    'Nhóm này đã thay đổi từ lúc hiển thị (có đơn bị huỷ, đã gán hoặc đã vào lượt khác). Danh sách gợi ý đã tải lại — chọn lại nhóm.',
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
