import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Landmark,
  Package,
  Percent,
  Settings,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react';

export interface NavAbility {
  action: string;
  subject: string;
}

export interface NavItem {
  label: string;
  href: string;
  /** Mục chỉ hiện khi ability.can(action, subject). Không có = ai đăng nhập cũng thấy. */
  ability?: NavAbility;
  /** Phím tắt hiển thị trong command palette, ví dụ 'g k' */
  shortcut?: string;
}

export interface NavModule extends NavItem {
  icon: LucideIcon;
  children?: NavItem[];
}

/**
 * Nav theo 8 nhóm của design canvas (DESIGN-BRIEF §5). Mục có subject backend
 * (tồn tại ở /auth/me) phải gắn ability; chỉ mục chưa có quyền backend tương ứng
 * (Giá & KM, RMA…) mới để trống — siết nốt khi backend thêm subject.
 * Module không gắn ability sẽ tự ẩn khi mọi mục con của nó bị ẩn.
 */
export const NAV_MODULES: NavModule[] = [
  {
    label: 'Tổng quan',
    href: '/',
    icon: LayoutDashboard,
    shortcut: 'g o',
  },
  {
    label: 'Bán hàng',
    href: '/crm/orders',
    icon: ShoppingCart,
    ability: { action: 'read', subject: 'SalesOrder' },
    shortcut: 'g d',
    children: [
      {
        label: 'Đơn hàng',
        href: '/crm/orders',
        ability: { action: 'read', subject: 'SalesOrder' },
      },
      {
        label: 'Tạo đơn',
        href: '/crm/orders/new',
        ability: { action: 'create', subject: 'SalesOrder' },
      },
      {
        label: 'Chờ duyệt',
        href: '/crm/orders/approvals',
        ability: { action: 'read', subject: 'SalesOrder' },
      },
      { label: 'Đơn hoàn / RMA', href: '/crm/returns' },
    ],
  },
  {
    label: 'Khách hàng',
    href: '/crm/customers',
    icon: Users,
    ability: { action: 'read', subject: 'Customer' },
    shortcut: 'g k',
    children: [
      {
        label: 'Danh sách khách hàng',
        href: '/crm/customers',
        ability: { action: 'read', subject: 'Customer' },
      },
      { label: 'Phân công', href: '/crm/customers/assign' },
      { label: 'Nhóm · cấp độ · tag', href: '/crm/segments' },
      { label: 'Gộp khách trùng', href: '/crm/customers/duplicates' },
      { label: 'Đồng ý marketing', href: '/crm/customers/consent' },
      {
        label: 'Ticket CSKH',
        href: '/crm/tickets',
        ability: { action: 'read', subject: 'Ticket' },
      },
    ],
  },
  {
    label: 'Sản phẩm',
    href: '/catalog/products',
    icon: Package,
    shortcut: 'g s',
    children: [
      {
        label: 'Danh sách sản phẩm',
        href: '/catalog/products',
        ability: { action: 'read', subject: 'Product' },
      },
      {
        label: 'Danh mục · thương hiệu',
        href: '/catalog/categories',
        ability: { action: 'read', subject: 'Product' },
      },
      {
        label: 'In tem barcode',
        href: '/catalog/barcode-print',
        ability: { action: 'read', subject: 'Product' },
      },
      {
        label: 'Lô & hạn dùng',
        href: '/catalog/lots',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Nhà cung cấp',
        href: '/catalog/suppliers',
        ability: { action: 'read', subject: 'Supplier' },
      },
    ],
  },
  {
    label: 'Kho',
    href: '/wms/stock',
    icon: Warehouse,
    shortcut: 'g w',
    children: [
      { label: 'Tồn kho', href: '/wms/stock', ability: { action: 'read', subject: 'Stock' } },
      {
        label: 'Kho & vị trí',
        href: '/wms/warehouses',
        ability: { action: 'read', subject: 'Stock' },
      },
      { label: 'Phiếu nhập kho', href: '/wms/grn', ability: { action: 'read', subject: 'Stock' } },
      { label: 'Phiếu xuất kho', href: '/wms/gdn', ability: { action: 'read', subject: 'Stock' } },
      {
        label: 'Điều phối task',
        href: '/wms/dispatch',
        ability: { action: 'read', subject: 'Task' },
      },
      {
        label: 'Chuyển kho',
        href: '/wms/transfers',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Purchase order',
        href: '/wms/po',
        ability: { action: 'read', subject: 'PurchaseOrder' },
      },
      { label: 'Kiểm kê', href: '/wms/stocktake', ability: { action: 'read', subject: 'Stock' } },
      {
        label: 'Điều chỉnh tồn',
        href: '/wms/adjustments',
        ability: { action: 'read', subject: 'Stock' },
      },
      { label: 'Sổ cái tồn', href: '/wms/ledger', ability: { action: 'read', subject: 'Stock' } },
      {
        label: 'Theo dõi giao hàng',
        href: '/wms/shipping',
        ability: { action: 'read', subject: 'Shipment' },
      },
      {
        label: 'Điểm đặt hàng lại',
        href: '/wms/reorder-points',
        ability: { action: 'read', subject: 'Stock' },
      },
    ],
  },
  {
    label: 'Giá & KM',
    href: '/pricing/price-lists',
    icon: Percent,
    shortcut: 'g g',
    children: [
      { label: 'Bảng giá', href: '/pricing/price-lists' },
      { label: 'Khuyến mãi', href: '/pricing/promotions' },
      { label: 'Mã giảm giá', href: '/pricing/coupons' },
      { label: 'Tích điểm', href: '/pricing/loyalty' },
      { label: 'Hoa hồng', href: '/pricing/commission' },
    ],
  },
  {
    label: 'Tài chính',
    href: '/fin/invoices',
    icon: Landmark,
    ability: { action: 'read', subject: 'Invoice' },
    shortcut: 'g h',
    children: [
      { label: 'Hóa đơn', href: '/fin/invoices', ability: { action: 'read', subject: 'Invoice' } },
      { label: 'Thanh toán & cấn trừ', href: '/fin/payments' },
      { label: 'Phải thu (tuổi nợ)', href: '/fin/receivables' },
      { label: 'Phải trả NCC', href: '/fin/payables' },
      { label: 'Giá vốn & giá trị tồn', href: '/fin/valuation' },
    ],
  },
  {
    label: 'Quản trị',
    href: '/admin/users',
    icon: Settings,
    ability: { action: 'read', subject: 'User' },
    shortcut: 'g q',
    children: [
      { label: 'Nhân viên', href: '/admin/users', ability: { action: 'read', subject: 'User' } },
      { label: 'Phòng ban & team', href: '/admin/teams' },
      {
        label: 'Vai trò & quyền',
        href: '/admin/roles',
        ability: { action: 'read', subject: 'Role' },
      },
      { label: 'Thiết bị PDA', href: '/admin/pda-devices' },
      {
        label: 'Nhật ký audit',
        href: '/admin/audit',
        ability: { action: 'read', subject: 'Audit' },
      },
      { label: 'Cấu hình hệ thống', href: '/admin/settings' },
      { label: 'Quy tắc duyệt', href: '/admin/approval-rules' },
      { label: 'Import / Export', href: '/admin/import' },
      { label: 'Webhook & tích hợp', href: '/admin/webhooks' },
    ],
  },
];

export interface CanFn {
  (action: string, subject: string): boolean;
}

export function visibleModules(can: CanFn): NavModule[] {
  return NAV_MODULES.map((m) => ({
    ...m,
    children: m.children?.filter((c) => !c.ability || can(c.ability.action, c.ability.subject)),
  })).filter(
    (m) =>
      (!m.ability || can(m.ability.action, m.ability.subject)) &&
      // Module có children mà bị ẩn hết → ẩn luôn module (href của nó cũng cần quyền)
      (!m.children || m.children.length > 0),
  );
}

/** Nhãn breadcrumb theo segment đường dẫn. Màn hình có thể override qua PageHeader. */
export const SEGMENT_LABELS: Record<string, string> = {
  crm: 'CRM',
  admin: 'Quản trị',
  catalog: 'Sản phẩm',
  wms: 'Kho',
  pricing: 'Giá & KM',
  fin: 'Tài chính',
  customers: 'Khách hàng',
  assign: 'Phân công',
  segments: 'Nhóm khách hàng',
  duplicates: 'Gộp khách trùng',
  consent: 'Đồng ý marketing',
  orders: 'Đơn hàng',
  approvals: 'Chờ duyệt',
  returns: 'Đơn hoàn',
  tickets: 'Ticket',
  invoices: 'Hóa đơn',
  payments: 'Thanh toán',
  receivables: 'Phải thu',
  payables: 'Phải trả',
  valuation: 'Giá vốn & giá trị tồn',
  products: 'Sản phẩm',
  categories: 'Danh mục',
  'barcode-print': 'In tem barcode',
  lots: 'Lô & hạn dùng',
  suppliers: 'Nhà cung cấp',
  stock: 'Tồn kho',
  warehouses: 'Kho & vị trí',
  grn: 'Phiếu nhập kho',
  gdn: 'Phiếu xuất kho',
  dispatch: 'Điều phối task',
  shipping: 'Theo dõi giao hàng',
  transfers: 'Chuyển kho',
  po: 'Purchase order',
  receive: 'Nhận hàng',
  stocktake: 'Kiểm kê',
  adjustments: 'Điều chỉnh tồn',
  ledger: 'Sổ cái tồn',
  'reorder-points': 'Điểm đặt hàng lại',
  'price-lists': 'Bảng giá',
  promotions: 'Khuyến mãi',
  coupons: 'Mã giảm giá',
  loyalty: 'Tích điểm',
  commission: 'Hoa hồng',
  reports: 'Báo cáo',
  dashboard: 'Tổng quan',
  users: 'Nhân viên',
  teams: 'Phòng ban & team',
  roles: 'Vai trò & quyền',
  'pda-devices': 'Thiết bị PDA',
  audit: 'Nhật ký audit',
  settings: 'Cấu hình hệ thống',
  'approval-rules': 'Quy tắc duyệt',
  import: 'Import / Export',
  webhooks: 'Webhook & tích hợp',
  new: 'Tạo mới',
  edit: 'Chỉnh sửa',
  me: 'Tài khoản',
};
