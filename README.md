# Connectly

Mạng xã hội kèm nhắn tin thời gian thực. Backend viết bằng .NET 10, tách thành bốn service nhỏ đặt sau một gateway YARP. Frontend là React + TypeScript + Vite.

Repo gồm toàn bộ mã nguồn backend, frontend, script chạy local và tài liệu thiết kế.

## Thành phần

| Thành phần | Cổng | Việc nó làm |
|---|---|---|
| `YarpApiGateway` | 5000 | Nhận request và chuyển tiếp theo tiền tố `/identity`, `/social`, `/chat`, `/notification` |
| `Identity.API` | 5201 | Đăng ký, đăng nhập, làm mới token, phiên thiết bị, tuỳ chọn giao diện |
| `Social.API` | 5202 | Hồ sơ, bạn bè, bài viết, bình luận, cảm xúc, story, reel, nhóm, sự kiện, trang, media |
| `Chat.API` | 5203 | Hội thoại trực tiếp và nhóm, tin nhắn, reaction, presence, đã đọc |
| `Notification.API` | 5204 | Hộp thư thông báo và đẩy realtime qua SignalR |
| `connectly-web` | 3000 | Giao diện React cho toàn bộ nghiệp vụ trên |

Hạ tầng đi kèm: PostgreSQL, Redis, RabbitMQ, object storage tương thích S3, Hangfire.

## Cấu trúc thư mục

```text
backend/
  Directory.Build.props           cấu hình chung: net10.0, nullable, implicit usings
  Directory.Packages.props        ghim phiên bản NuGet cho toàn bộ project
  Connectly.Backend.slnx          danh sách project
  .env.example                    mẫu biến môi trường backend
  run-all.ps1 / stop-all.ps1      chạy và dừng 5 tiến trình nền
  src/
    BuildingBlocks/
      BuildingBlocks/             env loader, JWT, PBKDF2, cursor, storage, migration runner
      BuildingBlocks.Messaging/   outbox, inbox, publisher và consumer RabbitMQ
    Contracts/Connectly.Contracts/  hằng số loại sự kiện và DTO sự kiện dùng chung
    ApiGateways/YarpApiGateway/    gateway
    Services/
      Identity/Identity.API/
      Social/Social.API/
      Chat/Chat.API/
      Notification/Notification.API/
docs/
  adr/                             quyết định kiến trúc
  api/                             mô tả endpoint từng service
  concepts/                        tài liệu thiết kế nghiệp vụ
  runbook.md                       ghi chú vận hành
frontend/                         ứng dụng React
template-database/
  connectly-social-db.sql         script dựng lại database: schema, dữ liệu mẫu, quyền
```

