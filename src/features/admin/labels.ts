/** Nhãn tiếng Việt cho catalog quyền (module.action từ apps/api). Code lạ → hiển thị nguyên code. */
export const MODULE_LABELS: Record<string, string> = {
  customer: 'Khách hàng',
  supplier: 'Nhà cung cấp',
  product: 'Sản phẩm',
  combo: 'Combo sản phẩm',
  sales_order: 'Đơn bán hàng',
  purchase_order: 'Đơn mua hàng',
  stock: 'Tồn kho',
  task: 'Công việc kho',
  shipment: 'Giao hàng',
  invoice: 'Hóa đơn',
  payment: 'Thanh toán',
  user: 'Nhân viên',
  role: 'Vai trò & quyền',
  period: 'Kỳ kế toán',
};

export const ACTION_LABELS: Record<string, string> = {
  read: 'Xem',
  create: 'Tạo',
  update: 'Sửa',
  delete: 'Xóa',
  cancel: 'Hủy',
  approve: 'Duyệt',
  post: 'Ghi sổ',
  assign: 'Phân công',
  receive: 'Nhận hàng',
  pick: 'Soạn hàng',
  adjust: 'Điều chỉnh',
  transfer: 'Chuyển kho',
  count: 'Kiểm kê',
  execute: 'Thực hiện',
  pack: 'Đóng gói',
  ship: 'Giao đi',
  close: 'Khóa kỳ',
};

export const moduleLabel = (m: string): string => MODULE_LABELS[m] ?? m;
export const actionLabel = (a: string): string => ACTION_LABELS[a] ?? a;

/** Nhãn ngắn các quyền trưởng phòng CSKH cấp cho trưởng nhóm (danh mục GROUP_GRANTABLE của api). */
export const CARE_GRANT_LABELS: Record<string, string> = {
  'user.group_add': 'Thêm NV',
  'user.group_edit': 'Sửa NV',
  'user.group_lock': 'Khóa NV',
  'sales_order.approve': 'Duyệt đơn',
  'sales_order.cancel': 'Hủy đơn',
  'report.sales_group': 'Doanh thu nhóm',
  'report.work': 'Báo cáo công việc',
};
