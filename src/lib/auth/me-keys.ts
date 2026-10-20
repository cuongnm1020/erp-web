/**
 * Query key của phiên đăng nhập (GET /auth/me). Đặt ở lib để feature khác (admin: đổi mật khẩu
 * lần đầu) làm mới phiên mà không import chéo features (luật 12).
 */
export const meKeys = { all: ['auth'] as const, me: ['auth', 'me'] as const };
