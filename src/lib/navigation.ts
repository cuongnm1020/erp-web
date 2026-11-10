import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Barcode,
  Boxes,
  CalendarClock,
  ChartLine,
  ClipboardList,
  Eraser,
  FileCheck2,
  Columns3,
  Flag,
  Gauge,
  Gift,
  GitMerge,
  Headset,
  Hourglass,
  Inbox,
  LayoutDashboard,
  Landmark,
  List,
  ListChecks,
  ListTodo,
  ListTree,
  MailCheck,
  MapPin,
  Network,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Percent,
  Plug,
  Plus,
  ReceiptText,
  Repeat,
  ScanBarcode,
  ScrollText,
  FileSpreadsheet,
  Settings,
  Printer,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Shuffle,
  Smartphone,
  Star,
  Table2,
  Tag,
  Tags,
  TriangleAlert,
  TicketPercent,
  TrendingDown,
  TrendingUp,
  Truck,
  Undo2,
  UserCog,
  Sprout,
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
  /**
   * Ẩn khỏi sidebar + command palette nhưng VẪN giữ trong bảng nav để `requiredAbilityFor`
   * còn gate URL trực tiếp (đừng comment mục ra — mất gate). Module ẩn thì ẩn cả mục con.
   */
  hidden?: boolean;
  /** Nhãn nhóm con trong module (Kho: Vận hành / Chứng từ / Danh mục kho / Màn PDA). */
  section?: string;
  /**
   * Điều kiện THÊM chỉ để hiện trên menu (sidebar + command palette) — KHÔNG gate URL. Dùng khi
   * người có quyền mở trang vẫn không nên thấy mục trên menu (Bán hàng với nhân viên kho).
   */
  menuAbility?: NavAbility;
}

/** Màu module ở menu trái (token --mod-*) — chỉ cho điều hướng, không mang nghĩa trạng thái. */
export type NavTone = 'sales' | 'cust' | 'prod' | 'wh' | 'rpt' | 'adm';

export interface NavModule extends NavItem {
  icon: LucideIcon;
  /** Màu nhóm trên sidebar; module không con (Tổng quan) dùng màu brand. */
  tone?: NavTone;
  children?: NavItem[];
}

/**
 * Nav theo 8 nhóm của design canvas (DESIGN-BRIEF §5). Mục có subject backend
 * (tồn tại ở /auth/me) phải gắn ability; chỉ mục chưa có quyền backend tương ứng
 * (Giá & KM, RMA…) mới để trống — siết nốt khi backend thêm subject.
 * Module không gắn ability sẽ tự ẩn khi mọi mục con của nó bị ẩn.
 * Sidebar vẽ module có children thành NHÓM MỞ/ĐÓNG ĐƯỢC (nút, không phải link) tô màu theo
 * `tone`, mục con bên dưới, chia nhóm con theo `section` (redesign 2026-10-17).
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
    tone: 'sales',
    ability: { action: 'read', subject: 'SalesOrder' },
    // Ẩn với nhân viên kho (user 2026-11-05) — kho làm đơn ở Kho › Vận hành › Đơn hàng.
    menuAbility: { action: 'view', subject: 'SalesMenu' },
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
    tone: 'cust',
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
        label: 'Khách của team',
        href: '/crm/care/customers',
        icon: Headset,
        // CSKH (2026-10-21): leader + member team CSKH (customer.care) — kho khách chung của team.
        ability: { action: 'care', subject: 'Customer' },
      },
      {
        label: 'Nhân viên của team',
        href: '/crm/care/staff',
        icon: UserCog,
        // Trưởng nhóm CSKH (2026-10-22): thêm / sửa / khóa nhân viên phòng CSKH mình phụ trách +
        // doanh thu từng người — thay Sơ đồ nhân sự (ẩn với CSKH).
        ability: { action: 'manage', subject: 'CareStaff' },
      },
      {
        label: 'Mục đích sử dụng',
        href: '/crm/care/purposes',
        icon: Sprout,
        // Biên bản CSKH 2026-10-26: đổi tên / gộp / xóa mục đích (Sầu riêng, Cà phê…) — Admin +
        // Trưởng phòng CSKH; tạo + gắn mục đích thì ai lên đơn cũng làm ở màn tạo đơn / hồ sơ khách.
        ability: { action: 'purpose_manage', subject: 'Customer' },
      },
      {
        label: 'Phân công',
        href: '/crm/customers/assign',
        icon: UsersRound,
        hidden: true,
        // Chỉ leader (customer.assign) — member không có mục này trong sidebar.
        ability: { action: 'assign', subject: 'Customer' },
      },
      {
        label: 'Nhóm · cấp độ · tag',
        href: '/crm/segments',
        icon: Tags,
        // CRM-02: nút tạo/sửa/xoá trong màn tự gate theo create/update/delete Customer.
        ability: { action: 'read', subject: 'Customer' },
      },
      {
        label: 'Gộp khách trùng',
        href: '/crm/customers/duplicates',
        icon: GitMerge,
        hidden: true, // ẩn khỏi menu (user 2026-11-03), URL vẫn gate theo quyền
        // CRM-10: chỉ quản trị (customer.merge) — người khác không thấy mục, URL bị chặn.
        ability: { action: 'merge', subject: 'Customer' },
      },
      {
        label: 'Đồng ý marketing',
        href: '/crm/customers/consent',
        icon: MailCheck,
        hidden: true, // ẩn khỏi menu (user 2026-11-03)
        // CRM-13: GET /consents cần customer.read — dữ liệu đã scope theo khách người xem phụ trách.
        // Menu (2026-10-22): chỉ Admin / vai trò được cấp riêng customer.consent_view.
        ability: { action: 'consent_view', subject: 'Customer' },
      },
      {
        label: 'Nhân viên Pancake',
        href: '/crm/pancake-staff',
        icon: UserCog,
        hidden: true, // ẩn khỏi menu (user 2026-11-03)
        // 2026-10-20: trưởng nhóm kinh doanh (sync.staff_read) thấy người chốt đơn Pancake chưa có
        // tài khoản thật và gắn họ vào nhân sự phòng mình.
        ability: { action: 'staff_read', subject: 'Sync' },
      },
    ],
  },
  {
    label: 'Sản phẩm',
    href: '/catalog/products',
    icon: Package,
    tone: 'prod',
    shortcut: 'g s',
    children: [
      {
        label: 'Danh sách sản phẩm',
        href: '/catalog/products',
        icon: Package,
        ability: { action: 'read', subject: 'Product' },
      },
      {
        label: 'Combo sản phẩm',
        href: '/catalog/combos',
        icon: Boxes,
        ability: { action: 'read', subject: 'Product' },
      },
      {
        label: 'Danh mục · thương hiệu',
        href: '/catalog/categories',
        icon: List,
        // Quyền riêng (2026-10-22): chỉ Admin / vai trò được cấp riêng product.categories.
        ability: { action: 'categories', subject: 'Product' },
      },
      {
        label: 'Thuế suất',
        href: '/catalog/tax-rates',
        icon: Percent,
        // Danh mục thuế suất (2026-10-23): kế toán + Admin (tax_rate.manage).
        ability: { action: 'manage', subject: 'TaxRate' },
      },
      {
        label: 'In tem barcode',
        href: '/catalog/barcode-print',
        icon: Barcode,
        hidden: true, // ẩn khỏi menu (user 2026-11-03)
        ability: { action: 'barcode_print', subject: 'Product' },
      },
      {
        label: 'Lô & hạn dùng',
        href: '/catalog/lots',
        icon: CalendarClock,
        hidden: true, // ẩn khỏi menu (user 2026-11-03)
        ability: { action: 'read', subject: 'Stock' },
      },
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
    tone: 'wh',
    shortcut: 'g w',
    // Chia 4 nhóm con theo `section` (redesign 2026-10-17) — thứ tự mảng = thứ tự hiển thị.
    children: [
      // Vận hành theo thứ tự Đơn hàng → Vận đơn → In đơn → Đơn lỗi (user 2026-11-05), sau đó các
      // màn điều phối. Tồn kho xuống Danh mục kho, Trạm đóng gói xuống Màn PDA (user 2026-11-05).
      {
        // In đơn (2026-11-04): clone màn Đơn hàng để tuỳ biến cho kho in đơn. Menu theo quyền kho
        // như "Theo dõi đơn" (shipment.read) — sale chỉ có sales_order.read không thấy module Kho.
        // Dữ liệu vẫn GET /sales-orders, API scope theo người xem. Menu đổi tên "Đẩy đơn"
        // (user 2026-11-05), rồi "Đơn hàng" (user 2026-11-05 tối).
        label: 'Đơn hàng',
        href: '/wms/print-orders',
        icon: ClipboardList, // máy in nhường cho "In đơn" (user 2026-11-06)
        section: 'Vận hành',
        ability: { action: 'read', subject: 'Shipment' },
        // Ẩn với sale + CSKH (user 2026-11-06) — họ dùng Bán hàng › Đơn hàng.
        menuAbility: { action: 'view', subject: 'WarehouseOpsMenu' },
      },
      {
        // Đổi tên menu "Theo dõi giao hàng" → "Vận đơn" (user 2026-11-05).
        label: 'Vận đơn',
        href: '/wms/shipping',
        icon: Truck,
        section: 'Vận hành',
        ability: { action: 'read', subject: 'Shipment' },
        menuAbility: { action: 'view', subject: 'WarehouseOpsMenu' },
      },
      {
        // Đơn đã gán vận chuyển (2026-11-03): đơn đã Gửi sang ĐVVC — lọc ngày gán / POS / phòng ban /
        // sản phẩm / hãng, in lại tem hàng loạt. Đổi tên "Theo dõi đơn" (user 2026-11-03),
        // menu đổi tiếp thành "In đơn" (user 2026-11-05).
        label: 'In đơn',
        href: '/wms/waybills',
        icon: Printer, // icon máy in (user 2026-11-06) — trước trùng icon xe tải với Vận đơn
        section: 'Vận hành',
        ability: { action: 'read', subject: 'Shipment' },
        menuAbility: { action: 'view', subject: 'WarehouseOpsMenu' },
      },
      {
        // Đơn lỗi (trước "Xử lý đơn lỗi" ở Quản trị) — chuyển sang Kho › Vận hành + đổi tên
        // (user 2026-11-05); URL giữ /admin/order-issues cho link cũ. Quyền sales_order.issues
        // (2026-11-03, gán cho nhân viên kho ở màn Vai trò; superadmin luôn có). Tab "Bị Pancake
        // ghi đè" bên trong vẫn chỉ superadmin (manage OrderIssue).
        label: 'Đơn lỗi',
        href: '/admin/order-issues',
        icon: TriangleAlert,
        section: 'Vận hành',
        ability: { action: 'issues', subject: 'SalesOrder' },
      },
      {
        label: 'Điều phối', // bỏ chữ "task" (user 2026-11-06)
        href: '/wms/dispatch',
        icon: Columns3,
        section: 'Vận hành',
        ability: { action: 'read_all', subject: 'Task' },
      },
      {
        // Chờ hàng (2026-10-25): SKU thiếu cho đơn chờ hàng / tổng đơn chờ. API cần sales_order.read
        // (sale chỉ thấy đơn mình); menu Kho hiện theo quyền xem tồn.
        label: 'Hàng chờ',
        href: '/wms/waiting-stock',
        icon: Hourglass,
        section: 'Vận hành',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Năng suất kho',
        href: '/wms/productivity',
        icon: Gauge,
        section: 'Vận hành',
        ability: { action: 'read_all', subject: 'Task' },
      },
      {
        // Dọn việc kho (2026-11-10): hủy mềm PICK / PACK / giữ chỗ — CHỈ superadmin. Không có quyền
        // nào tên WmsCleanup nên chỉ `manage all` (hasGlobalAccess) thấy menu; API 403 người khác.
        label: 'Dọn việc kho',
        href: '/wms/cleanup',
        icon: Eraser,
        section: 'Vận hành',
        ability: { action: 'manage', subject: 'WmsCleanup' },
      },
      {
        label: 'Phiếu nhập kho',
        href: '/wms/grn',
        icon: PackagePlus,
        section: 'Chứng từ',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Phiếu bán hàng',
        href: '/wms/gdn',
        icon: PackageMinus,
        section: 'Chứng từ',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Nhập hàng hoàn',
        href: '/wms/returns',
        icon: Undo2,
        section: 'Chứng từ',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Chuyển kho',
        href: '/wms/transfers',
        icon: ArrowLeftRight,
        section: 'Chứng từ',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Kiểm kê',
        href: '/wms/stocktake',
        icon: Table2,
        section: 'Chứng từ',
        ability: { action: 'read', subject: 'Stock' },
      },
      // {
      //   label: 'Purchase order',
      //   href: '/wms/po',
      //   icon: ClipboardList,
      //   ability: { action: 'read', subject: 'PurchaseOrder' },
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
      {
        label: 'Tồn kho',
        href: '/wms/stock',
        icon: Boxes,
        section: 'Danh mục kho',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Kho & vị trí',
        href: '/wms/warehouses',
        icon: MapPin,
        section: 'Danh mục kho',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Thùng / pallet',
        href: '/wms/containers',
        icon: Package,
        section: 'Danh mục kho',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Cảnh báo nhập hàng',
        href: '/wms/reorder-points',
        icon: Repeat,
        section: 'Danh mục kho',
        ability: { action: 'read', subject: 'Stock' },
      },
      {
        label: 'Lấy hàng (PDA)',
        href: '/pda/pick',
        icon: ScanBarcode,
        section: 'Màn PDA',
        ability: { action: 'execute', subject: 'Task' },
      },
      {
        label: 'Trạm đóng gói',
        href: '/wms/pack',
        icon: PackageCheck,
        section: 'Màn PDA',
        ability: { action: 'execute', subject: 'Task' },
      },
      {
        label: 'Cất hàng (PDA)',
        href: '/pda/put-away',
        icon: PackagePlus,
        section: 'Màn PDA',
        ability: { action: 'execute', subject: 'Task' },
      },
      {
        label: 'Tra / chuyển vị trí (PDA)',
        href: '/pda/location',
        icon: MapPin,
        section: 'Màn PDA',
        ability: { action: 'execute', subject: 'Task' },
      },
    ],
  },
  {
    label: 'Giá & KM',
    href: '/pricing/price-lists',
    icon: Percent,
    tone: 'sales',
    shortcut: 'g g',
    // Ẩn cả nhóm (2026-10-04): Bảng giá, Khuyến mãi, Mã giảm giá, Tích điểm, Hoa hồng.
    hidden: true,
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
    tone: 'rpt',
    // Chỉ kế toán + Admin (2026-10-26): invoice.create chỉ hai vai trò này có — trưởng nhóm kinh
    // doanh có invoice.read (xem hóa đơn của đơn) nhưng không thấy menu Tài chính. Gate cả URL.
    ability: { action: 'create', subject: 'Invoice' },
    shortcut: 'g h',
    // Ẩn cả nhóm Tài chính 2026-10-04; mở lại 2026-10-23 để kiểm các màn phần xuất hóa đơn.
    children: [
      {
        label: 'Hóa đơn',
        href: '/fin/invoices',
        icon: ReceiptText,
        ability: { action: 'create', subject: 'Invoice' },
      },
      {
        // MISA meInvoice (2026-10-28): hàng chờ từ đối soát hãng, duyệt 2 bước, đẩy nháp.
        label: 'Hóa đơn điện tử',
        href: '/fin/einvoices',
        icon: FileCheck2,
        ability: { action: 'read', subject: 'Einvoice' },
      },
      //{ label: 'Thanh toán & cấn trừ', href: '/fin/payments', icon: CreditCard },
      {
        label: 'Phải thu (tuổi nợ)',
        href: '/fin/receivables',
        icon: TrendingUp,
        hidden: true, // ẩn khỏi menu (user 2026-11-03)
        ability: { action: 'create', subject: 'Invoice' },
      },
      {
        label: 'Phải trả NCC',
        href: '/fin/payables',
        icon: TrendingDown,
        hidden: true, // ẩn khỏi menu (user 2026-11-03)
        ability: { action: 'create', subject: 'Invoice' },
      },
      {
        label: 'Lợi nhuận',
        href: '/fin/profit',
        icon: Percent,
        hidden: true, // ẩn khỏi Tài chính (user 2026-11-03) — vẫn ở nhóm Báo cáo
        ability: { action: 'profit', subject: 'Report' },
      },
      //{ label: 'Giá vốn & giá trị tồn', href: '/fin/valuation', icon: Coins },
    ],
  },
  {
    // RPT-07 (2026-10-05): nhóm Báo cáo — module không gắn ability, tự ẩn khi không có mục con
    // nào được phép. "Lợi nhuận" vẫn nằm trong nhóm Tài chính (đang ẩn) để gate URL như cũ, và
    // hiện ở đây cho người có report.profit.
    label: 'Báo cáo',
    href: '/reports/sales',
    icon: ChartLine,
    tone: 'rpt',
    shortcut: 'g b',
    children: [
      {
        label: 'Doanh thu bán hàng',
        href: '/reports/sales',
        icon: ChartLine,
        ability: { action: 'sales', subject: 'Report' },
      },
      {
        label: 'Lợi nhuận',
        href: '/fin/profit',
        icon: Percent,
        ability: { action: 'profit', subject: 'Report' },
      },
      {
        // Chuyển từ nhóm Tài chính sang (2026-10-26, Tài chính chỉ còn kế toán + Admin).
        label: 'Công việc & SLA',
        href: '/reports/work',
        icon: ClipboardList,
        // Ẩn khỏi menu (user 2026-11-03) — URL vẫn gate theo quyền.
        hidden: true,
        // report.work: quản lý (trưởng phòng / quản lý kho) — số liệu chỉ nhánh mình phụ trách.
        ability: { action: 'work', subject: 'Report' },
      },
    ],
  },
  {
    // Module Công việc (2026-10-22, docs/PLAN-ticket-sla.md §6): yêu cầu của khách, yêu cầu nội bộ,
    // giao việc. Chưa có token màu mod-work trong design system → không gắn tone (dùng màu brand
    // như Tổng quan) cho tới khi token được duyệt. Nằm dưới Báo cáo (user 2026-11-03).
    label: 'Công việc',
    href: '/work',
    icon: ListChecks,
    ability: { action: 'read', subject: 'Work' },
    shortcut: 'g v',
    children: [
      {
        label: 'Việc của tôi',
        href: '/work',
        icon: ListTodo,
        ability: { action: 'read', subject: 'Work' },
      },
      {
        label: 'Việc của team',
        href: '/work/team',
        icon: UsersRound,
        // Trưởng phòng / cấp trên (phụ trách phòng ban) — API tự lọc theo nhánh phụ trách.
        ability: { action: 'view', subject: 'WorkTeam' },
      },
      {
        label: 'Hàng chờ yêu cầu',
        href: '/work/queue',
        icon: Inbox,
        ability: { action: 'read', subject: 'Work' },
      },
      {
        label: 'Tạo việc',
        href: '/work/new',
        icon: Plus,
        hidden: true,
        ability: { action: 'create', subject: 'Work' },
      },
    ],
  },
  {
    // Không gắn ability ở module: trưởng phòng (không có user.read) vẫn thấy Sơ đồ nhân sự;
    // module tự ẩn khi mọi mục con bị ẩn. Mục con trước đây dựa vào cổng module → gắn read User.
    label: 'Quản trị',
    href: '/admin/org-tree',
    icon: Settings,
    tone: 'adm',
    shortcut: 'g q',
    children: [
      {
        label: 'Nhân viên',
        href: '/admin/users',
        icon: UserCog,
        ability: { action: 'read', subject: 'User' },
      },
      {
        label: 'Phòng ban & team',
        href: '/admin/teams',
        icon: Network,
        ability: { action: 'read', subject: 'User' },
      },
      {
        label: 'Sơ đồ nhân sự',
        href: '/admin/org-tree',
        icon: ListTree,
        ability: { action: 'view', subject: 'OrgChart' },
      },
      {
        label: 'Vai trò & quyền',
        href: '/admin/roles',
        icon: ShieldCheck,
        ability: { action: 'read', subject: 'Role' },
      },
      {
        label: 'Thiết bị PDA',
        href: '/admin/pda-devices',
        icon: Smartphone,
        ability: { action: 'read', subject: 'User' },
      },
      {
        label: 'Duyệt xuất Excel',
        href: '/admin/export-requests',
        icon: FileSpreadsheet,
        // Xuất Excel qua email chờ duyệt + nhật ký xuất / nhập (2026-11-02) — export.approve.
        ability: { action: 'approve', subject: 'Export' },
      },
      {
        // Mọi người đăng nhập: yêu cầu xuất của mình — vào từ toast "Xem yêu cầu" sau khi gửi.
        label: 'Yêu cầu xuất Excel của tôi',
        href: '/exports',
        icon: FileSpreadsheet,
        hidden: true,
      },
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
      {
        label: 'Page Facebook',
        href: '/admin/facebook-pages',
        icon: Flag,
        // Page Facebook gắn POS (2026-10-26): thêm / sửa / xóa — facebook_page.manage (ADMIN).
        ability: { action: 'manage', subject: 'FacebookPage' },
      },
      {
        label: 'Chia khách CSKH',
        href: '/admin/care-distribution',
        icon: Shuffle,
        // CSKH (2026-10-21): % khách mới chia về team CSKH + lịch sử lượt chia — chỉ quản trị.
        ability: { action: 'distribution_config', subject: 'Customer' },
      },
      {
        label: 'Cấu hình công việc',
        href: '/admin/work-config',
        icon: SlidersHorizontal,
        // Loại yêu cầu, ma trận SLA, giờ làm việc, ngày lễ — work.config (quản trị).
        ability: { action: 'config', subject: 'Work' },
      },
      {
        label: 'Cấu hình hệ thống',
        href: '/admin/settings',
        icon: Settings,
        // Hiện chỉ có tab Đơn vị vận chuyển (2026-10-04) — mở theo quyền của tab đó.
        ability: { action: 'config', subject: 'Carrier' },
      },
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
  const allowed = (a?: NavAbility) => !a || can(a.action, a.subject);
  return NAV_MODULES.filter((m) => !m.hidden)
    .map((m) => ({
      ...m,
      children: m.children?.filter(
        (c) => !c.hidden && allowed(c.ability) && allowed(c.menuAbility),
      ),
    }))
    .filter(
      (m) =>
        allowed(m.ability) &&
        allowed(m.menuAbility) &&
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
  returns: 'Nhập hàng hoàn',
  work: 'Công việc',
  team: 'Việc của team',
  queue: 'Hàng chờ yêu cầu',
  'work-config': 'Cấu hình công việc',
  invoices: 'Hóa đơn',
  payments: 'Thanh toán',
  receivables: 'Phải thu',
  payables: 'Phải trả',
  valuation: 'Giá vốn & giá trị tồn',
  profit: 'Lợi nhuận',
  products: 'Sản phẩm',
  categories: 'Danh mục',
  combos: 'Combo sản phẩm',
  'barcode-print': 'In tem barcode',
  care: 'CSKH',
  staff: 'Nhân viên của team',
  lots: 'Lô & hạn dùng',
  suppliers: 'Nhà cung cấp',
  stock: 'Tồn kho',
  warehouses: 'Kho & vị trí',
  grn: 'Phiếu nhập kho',
  gdn: 'Phiếu xuất kho',
  dispatch: 'Điều phối',
  pack: 'Trạm đóng gói',
  productivity: 'Năng suất kho',
  shipping: 'Vận đơn',
  transfers: 'Chuyển kho',
  po: 'Purchase order',
  receive: 'Nhận hàng',
  stocktake: 'Kiểm kê',
  adjustments: 'Điều chỉnh tồn',
  ledger: 'Sổ cái tồn',
  'reorder-points': 'Cảnh báo nhập hàng',
  'price-lists': 'Bảng giá',
  promotions: 'Khuyến mãi',
  coupons: 'Mã giảm giá',
  loyalty: 'Tích điểm',
  commission: 'Hoa hồng',
  reports: 'Báo cáo',
  sales: 'Doanh thu bán hàng',
  dashboard: 'Tổng quan',
  users: 'Nhân viên',
  teams: 'Phòng ban & team',
  roles: 'Vai trò & quyền',
  'pda-devices': 'Thiết bị PDA',
  'facebook-pages': 'Page Facebook',
  'export-requests': 'Duyệt xuất Excel',
  exports: 'Yêu cầu xuất Excel',
  audit: 'Nhật ký audit',
  settings: 'Cấu hình hệ thống',
  'approval-rules': 'Quy tắc duyệt',
  import: 'Import / Export',
  webhooks: 'Webhook & tích hợp',
  new: 'Tạo mới',
  edit: 'Chỉnh sửa',
  me: 'Tài khoản',
};
