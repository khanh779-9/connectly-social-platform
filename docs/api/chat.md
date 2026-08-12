# Chat API

Tiền tố qua gateway: `/chat/api/v1`. Mọi route đều cần Bearer.

## Hội thoại

| Method | Route | Ghi chú |
|---|---|---|
| POST | `/conversations` | body `{ type: dm hoặc group, title, memberUserIds }` |
| GET | `/conversations` | trả kèm tin nhắn cuối và số chưa đọc |
| GET | `/conversations/{conversationId}` | chi tiết hội thoại và thành viên |

Hội thoại trực tiếp được tái sử dụng: tạo lại giữa hai người đã có sẽ trả về hội thoại cũ.

## Tin nhắn

| Method | Route | Ghi chú |
|---|---|---|
| POST | `/conversations/{conversationId}/messages` | gửi tin, đẩy realtime `message-received` |
| GET | `/conversations/{conversationId}/messages` | phân trang bằng cursor |
| POST | `/conversations/{conversationId}/read` | cập nhật `LastReadAt`, phát `message-read` |
| PATCH | `/messages/{messageId}` | sửa trong 15 phút |
| DELETE | `/messages/{messageId}` | thu hồi trong 60 phút, xoá kèm tệp đính kèm |
| PUT | `/messages/{messageId}/reactions/{reactionType}` | thêm cảm xúc |
| DELETE | `/messages/{messageId}/reactions/{reactionType}` | bỏ cảm xúc |

## Tệp đính kèm

`POST /conversations/{conversationId}/attachments/ticket?fileName&contentType` trả presigned PUT vào nhánh `chat-data` của bucket.

## Presence và cài đặt

| Method | Route | Ghi chú |
|---|---|---|
| GET | `/presence?userIds=` | trạng thái online và lần hoạt động cuối |
| GET | `/me/chat-settings` | ai được nhắn tin cho người dùng hiện tại |
| PUT | `/me/chat-settings` | nhận `everyone`, `friends`, `nobody` |

## Hub SignalR

Địa chỉ `/hubs/chat`. Client có thể đăng ký nhận tin cho một hội thoại bằng `SubscribeConversation(id)`, huỷ bằng `UnsubscribeConversation(id)`, báo đang nhập bằng `NotifyTyping(id)`.

Sự kiện server gửi xuống: `message-received`, `message-read`, `message-updated`, `message-deleted`, `message-reaction`, `presence-updated`, `typing`.
