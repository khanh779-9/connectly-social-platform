# Notification API

Tiền tố qua gateway: `/notification/api/v1`.

## Hộp thư

| Method | Route | Ghi chú |
|---|---|---|
| GET | `/notifications` | nhận `status` và `limit`, mới nhất trước |
| GET | `/notifications/unread-count` | số chưa đọc, dùng cho badge |
| POST | `/notifications/{notificationId}/read` | chỉ đánh dấu thông báo của chính người gọi |
| POST | `/notifications/read-all` | đánh dấu toàn bộ là đã đọc |

`limit` bị chặn trong khoảng 1 đến 50. Thông báo do chính người dùng tạo ra không được ghi lại.

## Endpoint nội bộ

`POST /internal/notifications` dành cho service khác, xác thực bằng header `X-Internal-Key` so với biến `INTERNAL_API_KEY`. Body gồm người nhận, loại thông báo và nội dung xem trước. Hiện Identity dùng endpoint này cho thông báo chào mừng và đăng nhập từ thiết bị lạ.

## Hub SignalR

Địa chỉ `/hubs/notifications`. Sau khi kết nối thành công, hub gắn kết nối vào nhóm `user:{userId}` lấy từ claim `sub`. Khi có thông báo mới, server gửi sự kiện `notification-received`.

## Nguồn sinh thông báo

Notification lắng nghe 11 loại sự kiện từ Social: lời mời kết bạn, chấp nhận kết bạn, theo dõi, bình luận, cảm xúc, chia sẻ, yêu cầu vào nhóm, thành viên mới, bình chọn, xem story và nhắc tên.
