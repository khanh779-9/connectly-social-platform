# Identity API

Tiền tố qua gateway: `/identity/api/v1`.

## Xác thực

| Method | Route | Ghi chú |
|---|---|---|
| POST | `/auth/register` | body `{ email, password, displayName, rememberMe }`, trả cặp token |
| POST | `/auth/login` | body `{ email, password, rememberMe }`, ghi metadata thiết bị |
| POST | `/auth/refresh` | body `{ refreshToken, rememberMe }`, thu hồi token cũ và cấp cặp mới |
| GET | `/me` | cần Bearer, trả `{ userId, email, displayName, status }` |

Mật khẩu tối thiểu 8 ký tự. Email được chuẩn hoá trước khi so trùng. Đăng ký phát sự kiện `identity.user-registered.v1` để Social tạo hồ sơ.

## Tuỳ chọn

| Method | Route | Ghi chú |
|---|---|---|
| GET | `/me/preferences` | trả theme hiện tại, mặc định `system` |
| PUT | `/me/preferences` | body `{ theme }`, chỉ nhận `light`, `dark`, `system` |

## Phiên thiết bị

| Method | Route | Ghi chú |
|---|---|---|
| GET | `/security/sessions` | liệt kê phiên còn hiệu lực, đánh dấu phiên hiện tại theo header `X-Device-Id` |
| POST | `/security/sessions/revoke` | body `{ ids }`, chỉ thu hồi phiên của chính người gọi |

## Thông báo nội bộ

Identity gọi `POST /api/v1/internal/notifications` sang Notification với header `X-Internal-Key` để gửi thông báo hệ thống như chào mừng hoặc đăng nhập từ thiết bị lạ. Lỗi ở bước này không chặn đăng nhập.
