import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Columns3,
  Gift,
  LayoutDashboard,
  Landmark,
  List,
  MapPin,
  Network,
  Package,
  PackageMinus,
  PackagePlus,
  Percent,
  Plug,
  Plus,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Star,
  Tag,
  TicketPercent,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCog,
  UserRound,
  Users,
  UsersRound,
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
  /** Icon của mục — sidebar thu gọn chỉ còn icon nên mọi mục con đều phải có. */
  icon?: LucideIcon;
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
 * Sidebar vẽ module có children thành NHÃN NHÓM (không phải link) + các mục con
 * phẳng bên dưới (design/hide-sidebar.png, 404.png).
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
        icon: ShoppingCart,
        ability: { action: 'read', subject: 'SalesOrder' },
      },
      {
        label: 'Tạo đơn',
        href: '/crm/orders/new',
        icon: Plus,
        ability: { action: 'create', subject: 'SalesOrder' },
      },
      // {
      //   label: 'Chờ duyệt',
      //   href: '/crm/orders/approvals',
      //   icon: ArrowUp,
      //   ability: { action: 'read', subject: 'SalesOrder' },
      // },
      // { label: 'Đơn hoàn / RMA', href: '/crm/returns', icon: Undo2 },
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
        icon: UserRound,
        ability: { action: 'read', subject: 'Customer' },
      },
      {
        label: 'Phân công',
        href: '/crm/customers/assign',
        icon: UsersRound,
        // Chỉ leader (customer.assign) — member không có mục này trong sidebar.
        ability: { action: 'assign', subject: 'Customer' },
      },
      // { label: 'Nhóm · cấp độ · tag', href: '/crm/segments', icon: Tags },
      // { label: 'Gộp khách trùng', href: '/crm/customers/duplicates', icon: Merge },
      // { label: 'Đồng ý marketing', href: '/crm/customers/consent', icon: MailCheck },
      // {
      //   label: 'Ticket CSKH',
      //   href: '/crm/tickets',
      //   icon: Ticket,
      //   ability: { action: 'read', subject: 'Ticket' },
      // },
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
        icon: Package,
        ability: { action: 'read', subject: 'Product' },
      },
      {
        label: 'Danh mục · thương hiệu',
        href: '/catalog/categories',
        icon: List,
        ability: { action: 'read', subject: 'Product' },
      },
      // {
      //   label: 'In tem barcode',
      //   href: '/catalog/barcode-print',
      //   icon: Barcode,
      //   ability: { action: 'read', subject: 'Product' },
      // },
      // {
      //   label: 'Lô & hạn dùng',
      //   href: '/catalog/lots',
      //   icon: CalendarClock,
      //   ability: { action: 'read', subject: 'Stock' },
      // },
      {
        label: 'Nhà cung cấp',
        href: '/catalog/suppliers',
        icon: Truck,
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
      {
        label: 'Tồn kho',
        href: '/wms/stock',
        icon: Boxes,
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Kho & vị trí',
        href: '/wms/warehouses',
        icon: MapPin,
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Phiếu nhập kho',
        href: '/wms/grn',
        icon: PackagePlus,
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Phiếu bán hàng',
        href: '/wms/gdn',
        icon: PackageMinus,
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Điều phối task',
        href: '/wms/dispatch',
        icon: Columns3,
        ability: { action: 'read', subject: 'Task' },
      },
      // {
      //   label: 'Chuyển kho',
      //   href: '/wms/transfers',
      //   icon: ArrowLeftRight,
      //   ability: { action: 'read', subject: 'Stock' },
      // },
      // {
      //   label: 'Purchase order',
      //   href: '/wms/po',
      //   icon: ClipboardList,
      //   ability: { action: 'read', subject: 'PurchaseOrder' },
      // },
      // {
      //   label: 'Kiểm kê',
      //   href: '/wms/stocktake',
      //   icon: Table2,
      //   ability: { action: 'read', subject: 'Stock' },
      // },
      // {
      //   label: 'Điều chỉnh tồn',
      //   href: '/wms/adjustments',
      //   icon: SlidersHorizontal,
      //   ability: { action: 'read', subject: 'Stock' },
      // },
      // {
      //   label: 'Sổ cái tồn',
      //   href: '/wms/ledger',
      //   icon: BarChart3,
      //   ability: { action: 'read', subject: 'Stock' },
      // },
      // {
      //   label: 'Theo dõi giao hàng',
      //   href: '/wms/shipping',
      //   icon: PackageCheck,
      //   ability: { action: 'read', subject: 'Shipment' },
      // },
      // {
      //   label: 'Điểm đặt hàng lại',
      //   href: '/wms/reorder-points',
      //   icon: Repeat,
      //   ability: { action: 'read', subject: 'Stock' },
      // },
    ],
  },
  {
    label: 'Giá & KM',
    href: '/pricing/price-lists',
    icon: Percent,
    shortcut: 'g g',
    children: [
      { label: 'Bảng giá', href: '/pricing/price-lists', icon: Tag },
      { label: 'Khuyến mãi', href: '/pricing/promotions', icon: Gift },
      { label: 'Mã giảm giá', href: '/pricing/coupons', icon: TicketPercent },
      { label: 'Tích điểm', href: '/pricing/loyalty', icon: Star },
      { label: 'Hoa hồng', href: '/pricing/commission', icon: Percent },
    ],
  },
  {
    label: 'Tài chính',
    href: '/fin/invoices',
    icon: Landmark,
    ability: { action: 'read', subject: 'Invoice' },
    shortcut: 'g h',
    children: [
      {
        label: 'Hóa đơn',
        href: '/fin/invoices',
        icon: ReceiptText,
        ability: { action: 'read', subject: 'Invoice' },
      },
      //{ label: 'Thanh toán & cấn trừ', href: '/fin/payments', icon: CreditCard },
      { label: 'Phải thu (tuổi nợ)', href: '/fin/receivables', icon: TrendingUp },
      { label: 'Phải trả NCC', href: '/fin/payables', icon: TrendingDown },
      //{ label: 'Giá vốn & giá trị tồn', href: '/fin/valuation', icon: Coins },
    ],
  },
  {
    label: 'Quản trị',
    href: '/admin/users',
    icon: Settings,
    ability: { action: 'read', subject: 'User' },
    shortcut: 'g q',
    children: [
      {
        label: 'Nhân viên',
        href: '/admin/users',
        icon: UserCog,
        ability: { action: 'read', subject: 'User' },
      },
      { label: 'Phòng ban & team', href: '/admin/teams', icon: Network },
      {
        label: 'Vai trò & quyền',
        href: '/admin/roles',
        icon: ShieldCheck,
        ability: { action: 'read', subject: 'Role' },
      },
      { label: 'Thiết bị PDA', href: '/admin/pda-devices', icon: Smartphone },
      {
        label: 'Nhật ký audit',
        href: '/admin/audit',
        icon: ScrollText,
        ability: { action: 'read', subject: 'Audit' },
      },
      {
        label: 'Kết nối Pancake',
        href: '/admin/pancake',
        icon: Plug,
        ability: { action: 'config', subject: 'Sync' },
      },
      // { label: 'Cấu hình hệ thống', href: '/admin/settings', icon: Settings },
      // { label: 'Quy tắc duyệt', href: '/admin/approval-rules', icon: CheckCheck },
      // { label: 'Import / Export', href: '/admin/import', icon: ArrowDownUp },
      // { label: 'Webhook & tích hợp', href: '/admin/webhooks', icon: Webhook },
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

/**
 * Route → quyền cần có để MỞ trang (gate URL trực tiếp, không chỉ ẩn menu).
 * Khớp tiền tố dài nhất trên href của nav ('/' chỉ khớp chính xác); mục con cùng href
 * với module thắng module (>=) — module không gắn ability nhưng con có thì vẫn gate.
 * Không khớp mục nào / mục không có ability → null = ai đăng nhập cũng mở được.
 */
export function requiredAbilityFor(pathname: string): NavAbility | null {
  let best: { href: string; ability?: NavAbility } | null = null;
  const consider = (item: { href: string; ability?: NavAbility }) => {
    const match =
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (match && (!best || item.href.length >= best.href.length)) best = item;
  };
  for (const m of NAV_MODULES) {
    consider(m);
    for (const c of m.children ?? []) consider(c);
  }
  return (best as { href: string; ability?: NavAbility } | null)?.ability ?? null;
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
