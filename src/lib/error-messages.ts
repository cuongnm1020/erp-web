import { ApiError, NETWORK_ERROR } from './api/errors';
import { formatMoney, formatQuantity } from './format';

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
  AUTH_PASSWORD_CHANGE_REQUIRED: 'Bạn cần đổi mật khẩu trước khi tiếp tục. Mở trang Đổi mật khẩu.',
  NOT_FOUND: 'Không tìm thấy dữ liệu. Có thể đã bị xóa hoặc bạn không có quyền xem.',
  CONFLICT: 'Dữ liệu đã thay đổi ở nơi khác. Tải lại rồi thao tác lại.',
  UNIQUE_VIOLATION: 'Dữ liệu bị trùng với bản ghi đã có. Kiểm tra lại mã hoặc số điện thoại.',
  VALIDATION: 'Một số trường chưa hợp lệ. Kiểm tra các ô được đánh dấu.',
  DB_ERROR: 'Máy chủ gặp lỗi khi lưu dữ liệu. Thử lại; nếu vẫn lỗi, gửi mã truy vết cho IT.',
  SERVER_ERROR: 'Máy chủ gặp lỗi. Thử lại; nếu vẫn lỗi, gửi mã truy vết cho IT.',
  /** Một đơn trong lô gặp lỗi hệ thống (POST /sales-orders/send-to-carrier `failed[].code`). */
  INTERNAL_ERROR: 'Lỗi hệ thống khi xử lý đơn này. Thử gửi lại; nếu vẫn lỗi, báo IT số đơn.',
  UPSTREAM_INVALID: 'API trả về phản hồi không hợp lệ. Kiểm tra API đang chạy và cấu hình API_URL.',
  BAD_REQUEST: 'Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.',
  // Lên đơn (POST /sales-orders)
  INSUFFICIENT_STOCK: 'Không đủ tồn kho cho sản phẩm trong đơn. Giảm số lượng hoặc bỏ dòng thiếu.',
  DISCOUNT_ABOVE_MAX: 'Chiết khấu vượt trần của bảng giá. Giảm CK% rồi chốt lại.',
  SKU_NOT_SELLABLE: 'Sản phẩm đã ngừng bán. Bỏ dòng này khỏi đơn.',
  UOM_CONVERSION_MISSING: 'Đơn vị tính chưa có quy đổi về đơn vị cơ sở. Chọn đơn vị khác.',
  EMPTY_ORDER: 'Đơn chưa có dòng hàng nào. Thêm ít nhất một sản phẩm.',
  INVALID_ORDER_INPUT: 'Một số trường của đơn chưa hợp lệ. Kiểm tra các ô được đánh dấu.',
  // Danh sách đơn (GET /sales-orders?weightMin/weightMax)
  ORDER_WEIGHT_FILTER_TOO_BROAD:
    'Lọc cân nặng trên quá nhiều đơn. Chọn thêm Ngày đặt hoặc tab trạng thái để thu hẹp rồi lọc lại.',
  // Sắp theo Sản phẩm / Cân nặng (sortBy=items|weight) — sắp trong bộ nhớ, tối đa 200.000 đơn khớp lọc.
  ORDER_SORT_TOO_BROAD:
    'Quá nhiều đơn để sắp theo cột này (tối đa 200.000 đơn). Thu hẹp Ngày đặt, chọn tab trạng thái hoặc tìm cụ thể hơn, hay bỏ sắp theo cột này.',
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
  // Chuyển đơn sang kho khác (PLAN-warehouse-context K3)
  ORDER_WAREHOUSE_MOVE_LOCKED:
    'Kho đã nhận hoặc bắt đầu lấy hàng cho đơn này nên không chuyển kho được. Trả việc về hàng đợi ở Điều phối rồi chuyển lại.',
  ORDER_WAREHOUSE_WAYBILL_FORBIDDEN:
    'Đơn đã có vận đơn — chuyển kho sẽ hủy vận đơn này nên cần quyền hủy vận đơn. Nhờ kho hoặc quản lý chuyển kho.',
  MOVE_TARGET_WAREHOUSE_INVALID: 'Kho chuyển tới đã ngừng dùng. Chọn kho khác.',
  PANCAKE_ORDER_WAREHOUSE_LOCKED:
    'Pancake không cho đổi kho đơn này (đơn trên Pancake đã qua bước đóng gói, đã có vận đơn, hoặc Pancake từ chối) nên ERP không chuyển. Kiểm tra đơn trên Pancake rồi thử lại.',
  // Sửa sản phẩm đơn Pancake trên ERP rồi đẩy lên Pancake (2026-11-02).
  PANCAKE_ORDER_ITEMS_LOCKED:
    'Pancake không cho sửa sản phẩm đơn này nên ERP chưa sửa gì. Kiểm tra đơn trên Pancake rồi thử lại.',
  // Pancake chỉ giữ đơn giá nguyên đồng × SL (sự cố SOP2610-107401, 2026-11-03).
  PANCAKE_LINE_AMOUNT_INDIVISIBLE:
    'Thành tiền không chia hết cho số lượng — Pancake chỉ nhận đơn giá nguyên đồng nên ERP chưa lưu. Sửa thành tiền thành số chia hết cho số lượng.',
  // Quyền theo kho (PLAN-warehouse-context)
  WAREHOUSE_FORBIDDEN:
    'Bạn chưa được cấp quyền làm việc ở kho này. Đổi kho làm việc ở góc trái, hoặc nhờ quản lý cấp thêm kho.',
  DEVICE_WAREHOUSE_MISMATCH:
    'Việc này thuộc kho khác kho làm việc của tài khoản. Nhờ quản lý kiểm tra kho mặc định của bạn.',
  PANCAKE_WAREHOUSE_LINK_TAKEN:
    'Kho trên Pancake này đã nối với một kho ERP khác. Gỡ liên kết của kho đó trước rồi nối lại.',
  PANCAKE_WAREHOUSE_NOT_FOUND:
    'Shop không còn kho này trên Pancake (có thể vừa bị xóa). Tải lại danh sách kho rồi chọn lại.',
  // Hãng vận chuyển (tra cước ở màn sửa đơn, vận đơn ở bàn đóng gói)
  // 2026-11-13: gần như luôn là địa chỉ giao để trống ô Phường/xã (gõ cả "xã…, huyện…" vào ô số
  // nhà) — nói đúng nguyên nhân đó trước; kho chưa khai điểm lấy hàng là trường hợp hiếm.
  CARRIER_WAYBILL_DATA:
    'Địa chỉ giao chưa chọn Tỉnh / Phường xã (thường do gõ cả địa chỉ vào ô số nhà) nên chưa gửi được sang hãng. Sửa đơn, chọn Tỉnh / Phường xã rồi xin lại vận đơn. Địa chỉ đã đủ mà vẫn lỗi thì kho chưa khai điểm lấy hàng ở Kho & vị trí.',
  ORDER_ADDRESS_INCOMPLETE:
    'Địa chỉ giao chưa chọn Tỉnh / Phường xã (thường do gõ cả địa chỉ vào ô số nhà) — đơn chưa được gửi sang hãng. Sửa đơn, chọn Tỉnh / Phường xã rồi gửi lại.',
  CARRIER_NOT_CONFIGURED:
    'Hãng này chưa có token hoặc địa chỉ API. Quản trị viên nhập ở Quản trị › Cấu hình hệ thống › Đơn vị vận chuyển.',
  CARRIER_SECRET_KEY_MISSING:
    'Server chưa có APP_SECRET_KEY để mã hoá token hãng. Báo IT đặt biến môi trường rồi khởi động lại API.',
  CARRIER_API_ERROR: 'Hãng vận chuyển không phản hồi hoặc trả lỗi. Thử lại sau ít phút.',
  CARRIER_REJECTED:
    'Hãng vận chuyển từ chối dữ liệu đơn (thường là địa chỉ giao). Sửa đơn theo lý do hãng báo rồi xin vận đơn lại.',
  BARCODE_TAKEN: 'Mã này đã gán cho sản phẩm khác — mỗi mã chỉ thuộc một sản phẩm.',
  SKU_CODE_TAKEN: 'Mã này đã là mã của SKU khác — chọn mã khác.',
  // Danh mục thuế suất (2026-10-23)
  TAX_RATE_IN_USE:
    'Đã có đơn hàng dùng mức này nên không đổi được %. Thêm mức mới rồi gán cho sản phẩm.',
  TAX_RATE_DEFAULT_REQUIRED: 'Phải luôn có một mức mặc định — đặt mức khác làm mặc định trước.',
  TAX_RATE_CODE_TAKEN: 'Mã này đã có trong danh mục thuế suất — chọn mã khác.',
  // Xuất Excel qua email chờ duyệt (2026-11-02)
  EXPORT_APPROVAL_REQUIRED:
    'Bạn chưa có quyền xuất Excel trực tiếp — nhập email để gửi yêu cầu, quản trị duyệt xong sẽ gửi file.',
  EXPORT_FILE_INVALID:
    'File xuất không hợp lệ hoặc quá lớn (tối đa 15 MB) — thu hẹp bộ lọc rồi xuất lại.',
  EXPORT_REQUEST_STATE: 'Yêu cầu xuất vừa được người khác xử lý — tải lại để xem trạng thái mới.',
  // Hóa đơn điện tử MISA (2026-10-28)
  EINVOICE_NOT_CONFIGURED:
    'Chưa cấu hình đủ kết nối MISA — vào Hóa đơn điện tử › Cài đặt kết nối để nhập và chọn mẫu hóa đơn.',
  MISA_API_ERROR: 'MISA không nhận yêu cầu. Kiểm tra kết nối ở Cài đặt rồi thử lại.',
  EINVOICE_STATE: 'Hóa đơn đã đổi trạng thái — tải lại rồi làm tiếp.',
  EINVOICE_BLOCKED:
    'Có hóa đơn còn vấn đề phải xử lý (thiếu thuế suất, lệch tiền, giao thiếu chưa sửa) — bỏ chọn hoặc sửa trước khi duyệt.',
  EINVOICE_SAME_REVIEWER:
    'Bạn đã duyệt hóa đơn này nên không tự đẩy lên MISA được — nhờ người thứ hai đẩy.',
  EINVOICE_VERSION_CONFLICT: 'Hóa đơn vừa được người khác sửa — tải lại để xem bản mới.',
  CARRIER_RECON_FILE:
    'File đối soát không đọc được: cần file Excel có cột mã vận đơn ("Mã ĐH" / "Số hiệu bưu gửi") và cột tiền ("Thu hộ" / "Số tiền trả").',
  // Page Facebook (2026-10-26)
  FACEBOOK_PAGE_ID_TAKEN:
    'Page ID này đã có trong danh mục ở page khác — tìm page đó để sửa thay vì thêm mới.',
  FACEBOOK_PAGE_ID_LOCKED: 'Page ID đã gắn với đơn Pancake nên không đổi được.',
  STOCK_EXCEL_WAREHOUSE_MISMATCH:
    'File này là tồn của kho khác — chọn đúng kho đã xuất file, hoặc xuất lại file của kho này.',
  /** Hồ sơ Pancake — fb_id thuộc tài khoản thật khác (messageFor ghép thêm người đang giữ). */
  PANCAKE_FB_ID_TAKEN:
    'Facebook ID này đang gắn với tài khoản khác. Gỡ Facebook ID ở tài khoản đó trước nếu nhập đúng người.',
  ORDER_SKU_NOT_IN_WAREHOUSE:
    'Kho xuất của đơn không có sản phẩm cần giao. Đổi kho xuất hoặc chuyển hàng về kho rồi gửi lại.',
  ORDER_SKU_SELL_WAREHOUSE:
    'Đơn có sản phẩm chỉ bán từ kho khác. Đổi Kho xuất sang đúng kho đó hoặc bỏ sản phẩm khỏi đơn.',
  CARRIER_OPERATION_UNSUPPORTED:
    'Hãng này không hỗ trợ thao tác vừa gọi (tra cước / in nhãn). Chọn hãng khác hoặc làm tay.',
  CARRIER_NOT_FOUND: 'Hãng vận chuyển không tồn tại hoặc đã tắt. Tải lại danh sách hãng.',
  // Nhiều tài khoản một hãng (FE-CARRIER-ACC-1)
  // CSKH (2026-10-21)
  CARE_DISTRIBUTION_INVALID:
    'Tỷ lệ chia khách chưa hợp lệ — tổng các team phải đúng 100% và chỉ chia cho team CSKH đang hoạt động.',
  // Mục đích sử dụng (biên bản CSKH 2026-10-26)
  PURPOSE_NAME_TAKEN:
    'Đã có mục đích cùng tên. Gộp mục đích này vào mục đích đó thay vì đổi tên trùng.',
  CARE_JOB_ACTOR_NOT_FOUND:
    'Không có tài khoản quản trị nào đang hoạt động để đứng tên lượt chia khách. Báo quản trị hệ thống.',
  CARRIER_ACCOUNT_NOT_FOUND:
    'Tài khoản vận chuyển không còn hoặc không thuộc hãng đã chọn. Tải lại rồi chọn lại tài khoản.',
  CARRIER_ACCOUNT_INACTIVE:
    'Tài khoản vận chuyển này đang tắt. Chọn tài khoản khác hoặc bật lại ở Cấu hình hệ thống.',
  CARRIER_ACCOUNT_IN_USE:
    'Không xoá / tắt được tài khoản này: đang là mặc định hoặc đã cấp vận đơn. Đặt tài khoản khác làm mặc định, hoặc tắt thay vì xoá.',
  CARRIER_ACCOUNT_NAME_TAKEN: 'Hãng này đã có tài khoản cùng tên. Đặt tên khác.',
  // Tab Cần sửa (2026-11-02) — không Gửi sang ĐVVC được tới khi sửa.
  ORDER_NON_ERP_ITEMS:
    'Đơn có sản phẩm ngoài hệ thống (món gõ tay / SP Pancake tự tạo). Sửa đơn thay bằng sản phẩm trong hệ thống rồi mới gửi ĐVVC.',
  ORDER_WAYBILL_ERROR_UNRESOLVED:
    'Đơn đang lỗi vận đơn. Sửa đơn rồi bấm "Xin lại vận đơn" (tab Cần sửa) thay vì gửi lại.',
  ORDER_WAYBILL_ACCOUNT_LOCKED:
    'Đơn đã có vận đơn ở tài khoản khác của hãng này. Bấm "Hủy vận đơn cũ" rồi gửi lại.',
  // 2026-11-10: đổi hãng / tài khoản qua Gửi sang ĐVVC tự hủy mã cũ; cấp thẳng trên phiếu thì không.
  SHIPMENT_WAYBILL_LIVE:
    'Phiếu đang có vận đơn còn hiệu lực. Bấm "Gửi sang ĐVVC" chọn hãng / tài khoản mới — ERP tự hủy vận đơn cũ rồi cấp vận đơn mới.',
  ORDER_NO_ACTIVE_WAYBILL:
    'Đơn không có vận đơn còn hiệu lực để hủy (chưa cấp mã, đã hủy, hoặc gửi ngoài ERP qua Pancake).',
  PICKUP_WAREHOUSE_NOT_READY:
    'Kho lấy hàng chưa khai tỉnh/thành, phường/xã hoặc số điện thoại. Khai ở Kho › Kho & vị trí › Sửa kho rồi thử lại.',
  PICKUP_WAREHOUSE_MISSING:
    'Chưa biết lấy hàng ở kho nào. Chọn kho lấy hàng trên đơn hoặc đặt kho mặc định ở Kho & vị trí.',
  CARRIER_NO_WAYBILL: 'Phiếu giao chưa có mã vận đơn. Gán hãng và xin vận đơn trước.',
  SHIPMENT_NO_WAYBILL: 'Phiếu giao chưa có mã vận đơn. Gán hãng và xin vận đơn trước.',
  CARRIER_WAYBILL_NOT_FOUND:
    'Hãng không tìm thấy vận đơn này dưới tài khoản hãng của phiếu — vận đơn có thể được tạo ở tài khoản (shop) khác. In tem ERP thay thế, và báo quản lý kiểm tra tài khoản hãng của phiếu.',
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
    'Đơn đã đóng gói, hàng đã trừ kho — bạn không có quyền hủy đơn sau khi gán ĐVVC. Nhờ trưởng phòng / quản trị hủy (hàng tự nhập lại kho).',
  // Hủy đơn đã gán ĐVVC (2026-11-02): hệ thống gọi hãng hủy vận đơn TRƯỚC khi hủy đơn.
  ORDER_CARRIER_PICKED_UP:
    'Hãng đã lấy hàng — không hủy đơn được nữa. Liên hệ hãng chặn giao rồi xử lý bằng hoàn hàng.',
  ORDER_CARRIER_CANCEL_REJECTED:
    'Hãng không đồng ý hủy vận đơn nên đơn CHƯA bị hủy. Xem lý do của hãng, xử lý trên portal hãng rồi thử lại.',
  ORDER_CARRIER_CANCEL_FAILED:
    'Không gọi được hãng để hủy vận đơn nên đơn CHƯA bị hủy. Thử lại sau ít phút.',
  SHIPMENT_CANCELLED: 'Phiếu giao này đã hủy theo đơn — không đóng gói / giao hãng được nữa.',
  SHIPMENT_CANCEL_VIA_ORDER: 'Muốn hủy phiếu giao thì hủy đơn bán, không đổi tay trạng thái phiếu.',
  // "Đóng gói + in vận đơn" (bulk-fulfil) — mã trước đây rơi về câu chung "Yêu cầu không hợp lệ"
  // (2026-11-02, đơn SOP2611-1827xx).
  ORDER_NOT_EDITABLE: 'Đơn đã kết thúc (đã chốt hoặc đã hủy) — không đóng gói được nữa.',
  SHIPMENT_ALREADY_DISPATCHED:
    'Hãng đã lấy hàng / phiếu giao đã rời kho — không đóng gói lại được. Kiểm tra tồn với quản lý kho.',
  // Phiếu theo vận đơn Pancake còn hiệu lực (2026-11-10) — không xin thêm vận đơn hãng khác từ ERP.
  SHIPMENT_PANCAKE_WAYBILL_ACTIVE:
    'Đơn đang có vận đơn gửi từ Pancake. Hủy vận đơn đó trên Pancake rồi bấm Gửi sang ĐVVC lại để ERP tạo vận đơn mới.',
  SHIPMENT_INVALID_TRANSITION:
    'Phiếu giao không ở trạng thái đóng gói được (đã hủy / hãng đã xử lý). Mở đơn xem trạng thái phiếu giao.',
  SHIPMENT_NOT_FOUND: 'Không tìm thấy phiếu giao của đơn. Tải lại danh sách rồi thử lại.',
  SHIPMENT_NOT_PACKED: 'Phiếu giao chưa đóng gói — đóng gói trước rồi mới xin vận đơn / in tem.',
  PACK_TASK_NOT_FOUND:
    'Đơn chưa có việc đóng gói (PACK) — việc pick chưa xong hoặc chưa sinh. Thử lại sau ít phút.',
  PACK_LINE_NO_RESERVATION:
    'Phần hàng đang giữ chỗ cho đơn ít hơn số cần đóng gói (giữ chỗ đã bị nhả). Hủy rồi lên lại đơn, hoặc báo IT số đơn để giữ chỗ lại.',
  PACK_STOCK_SHORT:
    'Kệ lấy hàng không đủ hàng cho đơn — hàng ở đó đã giữ cho đơn khác đang lấy. Kiểm hàng thật trên kệ / nhập thêm hàng rồi đóng gói lại.',
  RESERVATION_NOT_ACTIVE:
    'Chỗ giữ hàng của đơn không còn hiệu lực (đã nhả hoặc đã dùng). Báo quản lý kho kiểm tồn của đơn.',
  INSUFFICIENT_COST_LAYERS:
    'Tồn của sản phẩm chưa có giá vốn (nhập tồn không qua phiếu nhập) — không trừ kho được. Báo kế toán / kho nhập giá vốn cho sản phẩm.',
  BALANCE_INCONSISTENT: 'Số tồn của sản phẩm đang lệch sổ — báo IT số đơn để kiểm tra.',
  TASK_INVALID_TRANSITION:
    'Việc lấy hàng / đóng gói đang ở trạng thái không đóng được (sự cố / đã hủy). Mở bảng điều phối xử lý việc đó trước.',
  INVALID_TASK_INPUT: 'Dữ liệu việc kho của đơn không hợp lệ. Báo IT số đơn.',
  INVALID_SHIPPING_INPUT:
    'Thông tin gửi hãng của đơn chưa hợp lệ (cân nặng / COD). Sửa đơn rồi thử lại.',
  RECIPIENT_ADDRESS_MISSING:
    'Đơn thiếu địa chỉ người nhận. Bổ sung địa chỉ ở màn sửa đơn rồi thử lại.',
  // Luồng đơn ERP (2026-10-31).
  ORDER_STAGE_LOCKED:
    'Kho đã xử lý đơn này (gửi hãng / chờ hàng / đang lấy hàng) — không sửa hay hủy được nữa. Liên hệ kho hoặc quản lý.',
  ORDER_NOT_DRAFT: 'Đơn không còn ở trạng thái Đơn mới — không cần xác nhận lại.',
  // Gửi sang ĐVVC (2026-11-06): đơn Đơn mới / Chờ duyệt không gửi hãng.
  ORDER_NOT_CONFIRMED:
    'Đơn chưa xác nhận (Đơn mới / Chờ duyệt) — bấm "Xác nhận đơn" trước rồi gửi sang ĐVVC.',
  // 2026-11-07 (user chốt): đã gửi hãng thì không ai sửa đơn; đổi hãng phải hủy vận đơn trước.
  ORDER_SENT_TO_CARRIER:
    'Đơn đã gửi sang đơn vị vận chuyển — không sửa được. Hủy vận đơn để đơn về Đã xác nhận rồi sửa / gửi hãng khác.',
  // 2026-11-10 (user chốt): gửi lại lô sang hãng khác — đơn đã có vận đơn lượt trước báo lỗi.
  ORDER_WAYBILL_LIVE:
    'Đơn đã có vận đơn của hãng khác (gửi thành công lượt trước) — bỏ tích đơn này, hoặc Hủy vận đơn trước nếu muốn đổi hãng.',
  ORDER_PACK_IN_PROGRESS: 'Kho đang đóng gói đơn này — chờ đóng gói xong rồi hủy.',
  // 2026-11-07 (user chốt): gán hãng kiểm tồn thực cả lô; hộp Gửi ĐVVC hiện danh sách SP thiếu.
  ORDER_CARRIER_STOCK_SHORT:
    'Không đủ tồn cho các đơn đang gán hãng — chưa gửi đơn nào. Bỏ bớt đơn thiếu hàng rồi gửi lại.',
  ORDER_WAITING_STOCK_INVALID:
    'Chỉ đơn Đã xác nhận (chưa gửi hãng, kho chưa lấy hàng) mới chuyển Chờ hàng; chỉ đơn đang Chờ hàng mới chuyển sang Đã xác nhận được.',
  // 2026-11-05 (user chốt): "Đóng gói + in vận đơn" không còn đóng gói thiếu.
  ORDER_PACK_SHORTAGE:
    'Đơn còn thiếu hàng — không đóng gói thiếu. Nhập đủ hàng vào kho rồi thử lại, hoặc sửa đơn bỏ dòng thiếu.',
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
  // Cất hàng tự chọn vị trí / chuyển vị trí (LOC-3/6/8)
  PDA_NOT_PUT_AWAY:
    'Mã này không phải việc cất hàng. Quét mã phiếu PUT… hoặc chạm việc trong hàng đợi.',
  PDA_PUTAWAY_NO_TARGET: 'Chưa có vị trí đích. Quét mã vị trí cần cất vào.',
  PDA_PUTAWAY_EMPTY: 'Giỏ trống. Quét thùng hoặc hàng rời trước rồi mới quét vị trí.',
  PDA_PUTAWAY_ALREADY_PLACED: 'Có thùng trong giỏ đã được cất. Xoá giỏ, tải lại việc rồi quét lại.',
  PDA_PUTAWAY_NOT_IN_TASK:
    'Có thùng không thuộc việc này hoặc đã được cất. Xoá giỏ, tải lại việc rồi quét lại.',
  PDA_PUTAWAY_QTY_EXCEEDS: 'Hàng rời vượt số còn phải cất. Giảm số lượng rồi thử lại.',
  PDA_RELOCATE_SAME: 'Vị trí đích trùng vị trí đang chuyển đi. Quét vị trí khác.',
  PDA_RELOCATE_CONTAINER_NOT_HERE:
    'Có thùng không còn nằm ở vị trí này. Tải lại vị trí rồi chọn lại.',
  PDA_RELOCATE_CONTAINER_PICKED:
    'Có thùng đã được quét lấy cho đơn — không chuyển được. Bỏ chọn thùng đó.',
  PDA_RELOCATE_QTY_EXCEEDS:
    'Số hàng rời vượt phần chuyển được (phần còn lại đã quét lấy cho đơn hoặc nằm trong thùng). Giảm số lượng.',
  PDA_RELOCATE_EMPTY: 'Vị trí này không còn hàng nào chuyển được.',
  RECEIPT_PUTAWAY_NOTHING: 'Phiếu không còn hàng chờ cất. Tải lại trang để xem tiến độ mới.',
  RECEIPT_CANCELLED: 'Phiếu nhập đã hủy — không sửa được. Tạo phiếu mới nếu cần.',
  RECEIPT_PUTAWAY_OPEN:
    'Phiếu đang cất hàng. Cất xong (hoặc "Cất tất cả vào vị trí mặc định") rồi sửa số lượng.',
  RECEIPT_LINE_PACKED:
    'Dòng nhập theo thùng — số lượng nằm trong từng thùng, không sửa trên phiếu. Sửa bằng kiểm kê vị trí.',
  RECEIPT_QTY_NOT_REDUCIBLE:
    'Không bớt được số lượng này — phần hàng của phiếu đã giữ chỗ cho đơn hoặc đã bán. Nhập số lớn hơn.',
  PDA_NO_DEFAULT_LOCATION: 'Kho chưa có vị trí DEFAULT đang dùng. Tạo ở màn Kho & vị trí.',
  PDA_LOCATION_OTHER_WAREHOUSE: 'Vị trí vừa quét thuộc kho khác. Quét vị trí trong kho của việc.',
  PDA_LOCATION_NOT_STORABLE:
    'Mã vừa quét là khu / dãy / kệ, không cất được. Quét tem tầng hoặc ô cụ thể.',
  PDA_TASK_LINE_NOT_FOUND: 'Dòng việc không còn tồn tại. Quét lại mã đơn để tải việc mới nhất.',
  PDA_SCAN_WRONG_SKU: 'Quét sai hàng — sản phẩm này không phải dòng đang lấy. Kiểm tra lại kệ.',
  PDA_SCAN_QTY_EXCEEDS_PLANNED:
    'Quét quá số lượng còn lại của dòng. Bỏ bớt hàng hoặc kiểm tra lại số đã quét.',
  PDA_LINE_NOT_FULLY_SCANNED: 'Dòng chưa quét đủ số lượng. Quét đủ rồi mới hoàn thành được.',
  PDA_LINE_WITHOUT_LOCATION:
    'Dòng này chưa có vị trí lấy hàng (thiếu tồn). Điều phối phải xử lý trước.',
  PDA_NO_RESERVATION:
    'Phần hàng đang giữ chỗ cho đơn ít hơn số cần đóng gói (giữ chỗ đã bị nhả). Báo điều phối kiểm tra lại đơn nguồn.',
  PDA_WAVE_SKU_NOT_FOUND: 'Sản phẩm này không có trong lượt hoặc đã lấy đủ. Kiểm tra lại kệ.',
  // Đơn mới + giao người đóng gói (2026-10-12, apps/api/docs/pick-pack-flow.md §7, §10)
  PDA_NEW_ORDERS_TAKEN:
    'Có đơn đã được người khác lấy trước hoặc không còn chờ lấy. Danh sách đã tải lại — chọn lại.',
  PDA_NEW_ORDERS_LIMIT:
    'Đang giữ quá nhiều đơn chưa lấy xong (tối đa 30). Bỏ bớt đơn đã chọn hoặc lấy xong việc đang giữ.',
  PDA_HANDOVER_PENDING:
    'Còn đơn đã lấy xong chưa giao người đóng gói. Chọn người đóng gói trước khi lấy đơn mới.',
  PDA_HANDOVER_EMPTY: 'Không còn đơn nào chờ giao người đóng gói.',
  PDA_INVALID_PACKER:
    'Không giao được cho người này (đã khóa, không có quyền đóng gói, chưa gán kho hoặc khác kho). Chọn người khác.',
  PDA_HANDOVER_NOT_YOURS: 'Lần giao này không phải của bạn — không đổi người đóng gói được.',
  WAVE_SELF_MERGE_STALE:
    'Danh sách đơn vừa thay đổi (có đơn đã bắt đầu lấy hoặc điều phối vừa đổi). Đã tải lại — bấm Gộp lượt lấy lần nữa.',
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
  // Sơ đồ nhân sự — ai được quản lý ai (StaffAccessService)
  STAFF_NOT_OWNED:
    'Bạn chỉ quản lý được nhân sự do chính mình tạo. Nhờ người đã tạo tài khoản này hoặc quản trị hệ thống.',
  DEPARTMENT_NOT_MANAGED:
    'Bạn chỉ thêm / chuyển nhân sự vào phòng ban mình phụ trách. Chọn phòng ban khác.',
  ROLE_ESCALATION: 'Không gán được vai trò có quyền bạn không có. Bỏ chọn vai trò đó.',
  // Đăng nhập thay (POST /auth/impersonate) — vai trò "Đăng nhập thay nhân viên" (2026-10-30)
  IMPERSONATE_FORBIDDEN:
    'Không đăng nhập thay được tài khoản này: chỉ nhân viên trong phòng ban / nhóm bạn quản lý, có quyền không vượt quyền bạn. Nhờ superadmin nếu cần.',
  DEPARTMENT_NOT_EMPTY:
    'Phòng ban còn phòng ban con hoặc còn nhân sự. Chuyển họ sang phòng ban khác rồi xóa lại.',
  ROLE_IN_USE: 'Vai trò đang gán cho người dùng. Gỡ vai trò khỏi họ ở màn Nhân viên rồi xóa lại.',
  ROLE_PERMISSIONS_SUPERADMIN_ONLY:
    'Chỉ quản trị hệ thống được đổi quyền của vai trò. Nhờ quản trị hệ thống sửa giúp.',
  PANCAKE_UNLOCK_SUPERADMIN_ONLY:
    'Chỉ quản trị hệ thống được cho đơn nhận lại dữ liệu từ Pancake. Nhờ quản trị hệ thống xử lý giúp.',
  ORDER_NOT_FROM_PANCAKE: 'Đơn này không đồng bộ từ Pancake.',
  ORDER_ISSUES_FORBIDDEN:
    'Bạn chưa có quyền "Xử lý đơn lỗi". Nhờ quản trị hệ thống gán quyền này cho vai trò của bạn.',
  WMS_CLEANUP_SUPERADMIN_ONLY:
    'Chỉ quản trị hệ thống được dùng màn Dọn việc kho. Nhờ quản trị hệ thống xử lý giúp.',
  ORDER_ISSUES_SUPERADMIN_ONLY:
    'Chỉ quản trị hệ thống được xem màn Xử lý đơn lỗi. Nhờ quản trị hệ thống xử lý giúp.',
  USER_PERMISSIONS_SUPERADMIN_ONLY:
    'Chỉ quản trị hệ thống được cấp riêng / chặn quyền của nhân viên. Nhờ quản trị hệ thống sửa giúp.',
  // Nhóm / cấp độ / tag khách hàng (/crm/segments)
  GROUP_IN_USE:
    'Nhóm vẫn còn khách hàng nên không xóa hẳn được. Chuyển khách sang nhóm khác, hoặc chỉ ngừng dùng nhóm.',
  TIER_IN_USE:
    'Cấp độ vẫn đang gán cho khách hàng nên không xóa được. Gỡ cấp khỏi các khách (hoặc chạy nâng hạng) rồi xóa lại.',
  CUSTOMER_GROUP_NOT_FOUND: 'Nhóm khách hàng không còn tồn tại. Tải lại danh sách nhóm.',
  CUSTOMER_TIER_NOT_FOUND: 'Cấp độ khách hàng không còn tồn tại. Tải lại danh sách cấp độ.',
  // Gộp khách trùng (/crm/customers/duplicates, CRM-07..09)
  MERGE_SELF: 'Không gộp được một khách vào chính nó. Chọn hai hồ sơ khác nhau.',
  MERGE_WALK_IN:
    'Khách vãng lai của Pancake gom đơn của nhiều người nên không được gộp. Bỏ hồ sơ này khỏi lựa chọn.',
  CUSTOMER_ALREADY_MERGED:
    'Một trong hai khách đã được gộp vào khách khác (có thể vừa có người gộp). Tải lại danh sách nhóm trùng.',
  PHONE_MISMATCH:
    'Hai khách khác số điện thoại. Chỉ gộp khi chắc chắn là cùng một người — xác nhận thêm một lần.',
  MERGE_ALREADY_UNDONE: 'Lần gộp này đã được hoàn tác trước đó. Tải lại lịch sử gộp.',
  MERGE_UNDO_CONFLICT:
    'Hồ sơ đã thay đổi sau lần gộp này nên không hoàn tác được. Tải lại lịch sử gộp.',
  MERGE_UNDO_CONFLICT_MERGED_CHANGED:
    'Hồ sơ cũ đã thay đổi sau lần gộp này (không còn trỏ về khách giữ) nên không hoàn tác được.',
  MERGE_UNDO_CONFLICT_SURVIVOR_MERGED:
    'Khách giữ đã bị gộp tiếp vào khách khác — hoàn tác lần gộp sau trước, rồi hoàn tác lần này.',
  TAG_NOT_FOUND: 'Tag không còn tồn tại (có thể vừa bị xóa). Tải lại danh sách tag.',
  INVALID_TIER_PERIOD: 'Kỳ tính doanh số không hợp lệ. Chọn số tháng từ 1 đến 120 rồi chạy lại.',
  // Đồng ý nhận tin (CRM-13) — trang hủy nhận tin công khai + ghi consent ở hồ sơ khách
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Đợi khoảng một phút rồi thử lại.',
  UNSUBSCRIBE_LINK_INVALID:
    'Link hủy nhận tin không hợp lệ hoặc đã bị sửa. Mở lại đúng link trong tin nhắn / email bạn nhận được.',
  CURRENT_PASSWORD_WRONG: 'Mật khẩu hiện tại không đúng. Nhập lại mật khẩu đang dùng để đăng nhập.',
  ACTUAL_STOCK_BELOW_RESERVED:
    'Tồn thực tế thấp hơn phần đang giữ cho đơn. Xử lý đơn đang giữ hàng (hủy hoặc đổi kho) rồi nhập lại.',
  TIER_JOB_ACTOR_NOT_FOUND:
    'Không có tài khoản quản trị đang hoạt động để đứng tên lượt nâng hạng. Báo IT kiểm tra tài khoản admin.',
  // Module Công việc (/work-items, /work-config — docs/PLAN-ticket-sla.md §6)
  WORK_INVALID_TRANSITION:
    'Việc đã đổi trạng thái nên thao tác này không còn hợp lệ. Tải lại để xem trạng thái mới.',
  WORK_STALE: 'Việc vừa được người khác cập nhật. Tải lại để xem thay đổi rồi làm tiếp.',
  WORK_ALREADY_CLAIMED: 'Yêu cầu này vừa có người nhận. Tải lại để xem ai đang xử lý.',
  WORK_ASSIGN_OUT_OF_TREE:
    'Chỉ giao được việc cho người trong phòng ban bạn phụ trách. Người ở phòng khác → gửi Yêu cầu nội bộ.',
  WORK_ACTION_FORBIDDEN:
    'Bạn không làm được thao tác này trên việc đang mở (không phải người làm / người giao / leader nhận).',
  WORK_INVALID: 'Thông tin việc chưa hợp lệ. Kiểm tra các ô được đánh dấu.',
  WORK_CONFIG_INVALID: 'Cấu hình chưa hợp lệ. Kiểm tra các ô được đánh dấu.',
  IDEMPOTENCY_KEY_OWNER_MISMATCH:
    'Yêu cầu bị trùng mã gửi với người khác. Tải lại trang rồi gửi lại.',
  IDEMPOTENCY_IN_PROGRESS: 'Yêu cầu trước vẫn đang xử lý. Đợi vài giây rồi tải lại để xem kết quả.',
};

const BY_STATUS: Record<number, string> = {
  401: MESSAGES.UNAUTHORIZED!,
  403: MESSAGES.FORBIDDEN!,
  404: MESSAGES.NOT_FOUND!,
  409: MESSAGES.CONFLICT!,
  413: 'File quá lớn — ảnh tối đa 5MB.',
  422: MESSAGES.VALIDATION!,
  429: MESSAGES.RATE_LIMITED!,
};

export function messageForCode(code: string, status?: number): string {
  return (
    MESSAGES[code] ??
    (status !== undefined ? BY_STATUS[status] : undefined) ??
    (status !== undefined && status >= 500 ? MESSAGES.SERVER_ERROR! : MESSAGES.BAD_REQUEST!)
  );
}

/**
 * Câu cho lỗi TỪNG ĐƠN trong lô (bulk-fulfil, gửi hãng…, 2026-11-02): mã chưa có câu dịch thì nói rõ
 * mã lỗi để kho báo IT — không rơi về câu chung "Yêu cầu không hợp lệ" (vô nghĩa với từng đơn).
 */
export function messageForItemCode(code: string): string {
  return MESSAGES[code] ?? `Lỗi ${code} khi xử lý đơn này. Báo IT số đơn và mã lỗi.`;
}

/**
 * "Thiếu: SP-0213 × 10, SP-0108 × 1." — dòng thiếu của ORDER_PACK_SHORTAGE (dữ liệu `shortages`,
 * không phải message thô — luật 6). Rỗng → chuỗi rỗng.
 */
export function packShortageText(
  shortages: ReadonlyArray<{ skuCode: string; qtyMissing: string }>,
) {
  if (shortages.length === 0) return '';
  return `Thiếu: ${shortages.map((s) => `${s.skuCode} × ${s.qtyMissing}`).join(', ')}.`;
}

/** Câu hiển thị cho mọi lỗi — ApiError hoặc lỗi JS bất kỳ. Không bao giờ trả message thô. */
export function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'ORDER_PACK_SHORTAGE') {
      const d = err.details as { shortages?: unknown } | null;
      const list = Array.isArray(d?.shortages)
        ? (d.shortages as Array<{ skuCode?: unknown; qtyMissing?: unknown }>).flatMap((s) =>
            typeof s.skuCode === 'string' && typeof s.qtyMissing === 'string'
              ? [{ skuCode: s.skuCode, qtyMissing: s.qtyMissing }]
              : [],
          )
        : [];
      return `${MESSAGES.ORDER_PACK_SHORTAGE!} ${packShortageText(list)}`.trim();
    }
    if (err.code === 'ORDER_SKU_SELL_WAREHOUSE') {
      // Sản phẩm + kho được bán là dữ liệu (details.skus), không phải message thô (luật 6).
      const d = err.details as { skus?: unknown } | null;
      const skus = Array.isArray(d?.skus)
        ? (d.skus as Array<{ code?: unknown; sellWarehouseName?: unknown }>).flatMap((s) =>
            typeof s.code === 'string' && typeof s.sellWarehouseName === 'string'
              ? [`${s.code} chỉ bán từ ${s.sellWarehouseName}`]
              : [],
          )
        : [];
      if (skus.length) {
        return `${skus.join(', ')}. Đổi Kho xuất sang đúng kho đó hoặc bỏ sản phẩm khỏi đơn.`;
      }
    }
    if (err.code === 'BARCODE_TAKEN') {
      // Mã + SKU đang giữ mã là dữ liệu (details), không phải message thô của server.
      const d = err.details as { code?: unknown; skuCode?: unknown; skuName?: unknown } | null;
      if (d && typeof d.skuCode === 'string') {
        return `Mã ${String(d.code ?? '')} đã gán cho ${d.skuCode}${typeof d.skuName === 'string' ? ` — ${d.skuName}` : ''}. Mỗi mã chỉ thuộc một sản phẩm.`;
      }
    }
    if (err.code === 'ORDER_CARRIER_CANCEL_REJECTED') {
      // Lời hãng là dữ liệu (details.carrierMessage), không phải message thô của server (luật 6).
      const d = err.details as { carrierMessage?: unknown } | null;
      if (d && typeof d.carrierMessage === 'string' && d.carrierMessage) {
        return `${MESSAGES.ORDER_CARRIER_CANCEL_REJECTED!} ${carrierSaid(d.carrierMessage)}`;
      }
    }
    if (err.code === 'STOCK_EXCEL_WAREHOUSE_MISMATCH') {
      const d = err.details as { fileWarehouseCode?: unknown; warehouseName?: unknown } | null;
      if (d && typeof d.fileWarehouseCode === 'string') {
        return `File này là tồn của kho ${d.fileWarehouseCode}, đang nhập vào ${typeof d.warehouseName === 'string' ? d.warehouseName : 'kho khác'}. Chọn đúng kho đã xuất file, hoặc xuất lại file của kho này.`;
      }
    }
    if (err.code === 'RECEIPT_QTY_NOT_REDUCIBLE') {
      // Số tối đa + lý do là dữ liệu (details), không phải message thô (luật 6).
      const d = err.details as { lineNo?: unknown; max?: unknown; reason?: unknown } | null;
      if (d && typeof d.max === 'string' && typeof d.lineNo === 'number') {
        const why =
          d.reason === 'SOLD'
            ? 'phần còn lại của phiếu đã bán / xuất'
            : 'phần còn lại đang giữ chỗ cho đơn';
        return `Dòng ${d.lineNo} chỉ bớt được tối đa ${formatQuantity(d.max)} — ${why}. Nhập số lớn hơn.`;
      }
    }
    if (err.code === 'SKU_CODE_TAKEN') {
      const d = err.details as { code?: unknown; skuCode?: unknown; skuName?: unknown } | null;
      if (d && typeof d.skuCode === 'string') {
        return `Mã ${String(d.code ?? '')} đã là mã của SKU ${d.skuCode}${typeof d.skuName === 'string' ? ` — ${d.skuName}` : ''}. Chọn mã khác.`;
      }
    }
    if (err.code === 'PANCAKE_FB_ID_TAKEN') {
      // Người đang giữ fb_id là dữ liệu (details.users), không phải message thô của server.
      const users = (err.details as { users?: { code?: unknown; fullName?: unknown }[] } | null)
        ?.users;
      const who = (users ?? [])
        .filter((u) => typeof u.code === 'string')
        .map((u) => `${String(u.code)}${typeof u.fullName === 'string' ? ` (${u.fullName})` : ''}`)
        .join(', ');
      if (who) {
        return `Facebook ID này đang gắn với tài khoản ${who}. Gỡ Facebook ID ở tài khoản đó trước nếu nhập đúng người.`;
      }
    }
    if (err.code === 'WORK_ALREADY_CLAIMED') {
      // Tên người vừa nhận là dữ liệu (details.assigneeName), không phải message thô của server.
      const d = err.details as { assigneeName?: unknown; docNumber?: unknown } | null;
      if (d && typeof d.assigneeName === 'string') {
        return `${d.assigneeName} vừa nhận ${typeof d.docNumber === 'string' ? d.docNumber : 'yêu cầu này'}. Chọn yêu cầu khác trong hàng chờ.`;
      }
    }
    if (err.code === 'ACTUAL_STOCK_BELOW_RESERVED') {
      // SKU vướng + số lượng là dữ liệu (details), không phải message thô của server.
      const d = err.details as { skuCode?: unknown; reserved?: unknown } | null;
      if (d && typeof d.skuCode === 'string') {
        return `${d.skuCode}: tồn thực tế thấp hơn phần đang giữ cho đơn (${String(d.reserved ?? '')}). Xử lý đơn đang giữ hàng rồi nhập lại.`;
      }
    }
    if (err.code === 'PANCAKE_LINE_AMOUNT_INDIVISIBLE') {
      // SKU, SL, mức gợi ý là dữ liệu (details.lines), không phải message thô của server.
      const d = err.details as {
        lines?: { code?: unknown; qty?: unknown; lower?: unknown; upper?: unknown }[];
      } | null;
      const parts = (d?.lines ?? [])
        .filter((l) => typeof l.code === 'string' && typeof l.lower === 'string')
        .map(
          (l) =>
            `${String(l.code)} ×${String(l.qty)}: chọn ${formatMoney(String(l.lower), { unit: '' })} hoặc ${formatMoney(String(l.upper), { unit: '' })}`,
        );
      if (parts.length) {
        return `Pancake chỉ nhận đơn giá nguyên đồng nên ERP chưa lưu — thành tiền phải chia hết cho số lượng. ${parts.join('; ')}.`;
      }
    }
    if (err.code === 'PANCAKE_ORDER_ITEMS_LOCKED') {
      // SKU thiếu / trạng thái / vận đơn / lời Pancake là dữ liệu (details), không phải message thô.
      const d = err.details as {
        missingSkus?: { code?: unknown; name?: unknown }[];
        pancakeStatus?: unknown;
        waybill?: unknown;
        pancakeSaid?: unknown;
      } | null;
      const skus = (d?.missingSkus ?? [])
        .filter((s) => typeof s.code === 'string')
        .map((s) => `${String(s.code)}${typeof s.name === 'string' ? ` ${s.name}` : ''}`);
      if (skus.length) {
        return `Không tự đưa được sản phẩm lên shop Pancake của đơn: ${skus.join(', ')}. Chọn sản phẩm khác hoặc báo quản trị kiểm tra đồng bộ Pancake — ERP chưa sửa gì.`;
      }
      if (typeof d?.waybill === 'string') {
        return `Đơn đã có vận đơn ${d.waybill} trên Pancake — không sửa sản phẩm được nữa.`;
      }
      if (typeof d?.pancakeStatus === 'string') {
        return `Đơn đang ở trạng thái "${d.pancakeStatus}" trên Pancake — hàng đã đóng gói / đi, không sửa sản phẩm được nữa.`;
      }
      if (typeof d?.pancakeSaid === 'string') {
        return `Pancake từ chối sửa sản phẩm, ERP chưa sửa gì. Pancake báo: "${d.pancakeSaid}".`;
      }
    }
    const base = messageForCode(err.code, err.status);
    const said = carrierReasonOf(err);
    return said ? `${base} ${carrierSaid(said)}` : base;
  }
  return MESSAGES.SERVER_ERROR!;
}

/**
 * Câu NGUYÊN VĂN của hãng vận chuyển khi hãng từ chối dữ liệu (`CARRIER_REJECTED`,
 * `details.carrierMessage`). Đây là lời của hãng — dữ liệu để biết sửa gì trên đơn — không phải
 * `message` của server, nên được hiện (luật 6 vẫn giữ: câu chính vẫn đi qua bảng mã).
 */
export function carrierReasonOf(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== 'CARRIER_REJECTED') return null;
  const m = (err.details as { carrierMessage?: unknown } | null | undefined)?.carrierMessage;
  return typeof m === 'string' && m.trim() ? m.trim() : null;
}

/** `Hãng báo: "…".` — một cách trình bày cho mọi màn. */
export function carrierSaid(reason: string): string {
  return `Hãng báo: “${reason}”.`;
}

export function hasMessageFor(code: string): boolean {
  return code in MESSAGES;
}
