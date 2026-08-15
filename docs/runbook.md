# Runbook

Ghi chú vận hành khi chạy Connectly ở máy local.

## Kiểm tra nhanh

1. Bốn database đã tồn tại: `connectly_identity`, `connectly_social`, `connectly_chat`, `connectly_notification`.
2. Redis trả lời `PING`.
3. RabbitMQ mở được giao diện quản trị ở cổng 15672.
4. SeaweedFS trả lời ở cổng 8333 và bucket `connectly` đã được tạo.
5. Gateway ở cổng 5000 trả về danh sách route ở đường dẫn gốc.

Mỗi service có endpoint `/health` trả JSON, dùng để kiểm tra nhanh trước khi thử gọi nghiệp vụ.

## Lỗi thường gặp

**Service khởi động nhưng gọi API trả 401.** Kiểm tra `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` ở tất cả service phải giống nhau. Token phát bởi Identity nhưng kiểm tra bởi Social, Chat và Notification.

**Không nhận được sự kiện.** Xem cột `processed_at` trong bảng `outbox_messages`. Nếu có dòng chưa xử lý thì dispatcher chưa chạy hoặc không kết nối được RabbitMQ. Nếu đã xử lý mà bên nhận không thấy dữ liệu thì kiểm tra bảng `inbox_messages` và log consumer.

**Upload trả 403 từ SeaweedFS.** Presigned URL hết hạn sau 15 phút. Nếu chạy SeaweedFS có cấu hình IAM thì access key trong `.env` phải tồn tại trong đó.

**Không thấy ai online.** Chat cần Redis. Nếu Redis chết, presence trả rỗng nhưng tin nhắn vẫn đi bình thường.

**Port đã bị chiếm.** Chạy `stop-all.ps1` để dọn tiến trình cũ theo file PID và theo cổng 5000, 5201 đến 5204.

## Log

`run-all.ps1` ghi hai file cho mỗi service trong `backend/logs/`, một file cho stdout và một cho stderr. Thư mục này không được đưa lên git.

## Reset dữ liệu

Dừng toàn bộ service, xoá bốn database rồi chạy lại script `deploy/docker/initdb/01-create-dbs.sh` hoặc bật `MIGRATE_ON_STARTUP=true` cho lần khởi động kế tiếp.
