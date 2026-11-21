# Connectly

Mạng xã hội kèm nhắn tinackend viết bằng .NET 10, tách thành bốn service nhỏ đặt sau một gateway YARP. Frontend là React + TypeScript + Vite.

Đồ án tốt nghiệp cuối khoá

## Thành phần

| Thành phần         | Cổng | Mô tả                                                                                          |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| `YarpApiGateway`   | 5000  | Nhận request và chuyển tiếp theo tiền tố `/identity`, `/social`, `/chat`, `/notification` |
| `Identity.API`     | 5201  | Đăng ký, đăng nhập, làm mới token, phiên thiết bị, tuỳ chọn giao diện                     |
| `Social.API`       | 5202  | Hồ sơ, bạn bè, bài viết, bình luận, cảm xúc, story, reel, nhóm, sự kiện, trang, media      |
| `Chat.API`         | 5203  | Hội thoại tin nhắn, cảm xúc, ...                                                                   |
| `Notification.API` | 5204  | Hộp thư thông báo và đẩy realtime qua SignalR                                                    |
| `connectly-web`    | 3000  | Giao diện React cho toàn bộ nghiệp vụ trên                                                        |

Nền tảng: PostgreSQL, Redis, RabbitMQ, object storage tương thích S3, Hangfire.

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
    Contracts/Connectly.Contracts/  
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

## Hạ tầng

Bốn dịch vụ hạ tầng, mỗi thứ một nhà cung cấp khác nhau:

|                | Cloud (`backend/.env`)                                    | Local (`backend/.env.example`) |
| -------------- | ----------------------------------------------------------- | -------------------------------- |
| PostgreSQL     | Aiven, `pg-7463afe-...a.aivencloud.com:27029`             | `localhost:5432`               |
| Redis          | Aiven Valkey, `valkey-10904112-...a.aivencloud.com:27030` | `localhost:6379`               |
| RabbitMQ       | CloudAMQP, `chameleon-01.lmq.cloudamqp.com:5672`          | `localhost:5672`               |
| Object storage | Oracle Object Storage, endpoint kiểu S3                    | SeaweedFS, `localhost:8333`    |

Toàn bộ host, cổng và mật khẩu nằm trong `backend/.env`. Không có host nào được viết cứng trong code.

**Giới hạn connection của Aiven.** Gói Aiven mình chỉ đc phép chạy 20 connection, 3 chỗ dành cho superuser (17 còn chạy đcc). Còn Npgsql mặc định mở pool tối đa 100 connection, mà dự án có 5 pool: Identity, Social, Chat, Notification và một pool của Hangfire nằm trong Social. Không giới hạn thì databasei lỗi `remaining connection slots are reserved`. Nên `backend/.env` để `POSTGRES_MAX_POOL_SIZE=3`, còn `backend/.env.example` để 10 vì local thì dùng đc đỡ hơn.

### Local

```bash
docker network create connectly

docker run -d --name connectly-postgres --network connectly ^
  -e POSTGRES_PASSWORD=123 -e POSTGRES_DB=connectly-social-db -p 5432:5432 postgres:16

docker run -d --name connectly-redis --network connectly -p 6379:6379 redis:7

docker run -d --name connectly-rabbit --network connectly ^
  -e RABBITMQ_DEFAULT_USER=connectly -e RABBITMQ_DEFAULT_PASS=connectly_dev_password ^
  -p 5672:5672 -p 15672:15672 rabbitmq:3-management

docker run -d --name connectly-seaweed --network connectly ^
  -p 8333:8333 chrislusf/seaweedfs server -dir=/data -s3 -s3.port=8333
```

## Cơ sở dữ liệu


| Schema           | Nội dung                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `identity`     | user, refresh token, tuỳ chọn giao diện                                                         |
| `social`       | hồ sơ, quan hệ, bài viết, bình luận, cảm xúc, nhóm, sự kiện, trang, story, reel, media |
| `chat`         | hội thoại, tin nhắn, reaction, cài đặt nhận tin                                             |
| `notification` | hộp thư thông báo                                                                              |
| `hangfire`     | bảng của Hangfire, khai báo bằng `SchemaName = "hangfire"` trong cấu hình storage          |

Ba view phụ trợ: `social.user_with_profile`, `notification.unread_counts` và `chat.conversation_with_last_message`.

Service đăng nhập bằng user của host, trên Aiven là `avnadmin`. Role `connectly` do script dựng database tạo ra, mang quyền cho các bảng, không dùng để đăng nhập này theo cấu hình của nền tảng.

### Cấu hình

Sao chép `backend/.env.example` thành `backend/.env` rồi chỉnh theo máy đang chạy. Service tự dò file `.env` ngược từ thư mục làm việc lên trên, nên chạy từ đâu trong `backend/` cũng đọc được. Biến môi trường đã tồn tại luôn được ưu tiên hơn giá trị trong file.

Các nhóm biến chính:

| Nhóm          | Biến                                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL     | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `POSTGRES_SSL_MODE`, `POSTGRES_MAX_POOL_SIZE`                                                                                              |
| Redis          | `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_SSL`                                                                                                                                                                     |
| RabbitMQ       | `RABBIT_HOST`, `RABBIT_PORT`, `RABBIT_USER`, `RABBIT_PASSWORD`, `RABBIT_VHOST`, `RABBIT_EVENT_EXCHANGE`                                                                                                                                   |
| Object storage | `SEAWEED_S3_ENDPOINT`, `SEAWEED_S3_ACCESS_KEY`, `SEAWEED_S3_SECRET_KEY`, `SEAWEED_S3_BUCKET`, `SEAWEED_S3_UPLOAD_URL_TTL_MINUTES`<br />Ở đây ban đầu mình xài tạm local trước, chừng nào báo cáo thì đưa lên nền tảng  |
| Xác thực     | `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TOKEN_TTL_MINUTES`, `JWT_REFRESH_TOKEN_TTL_DAYS`                                                                                                                                    |
| Cổng          | `GATEWAY_PORT`, `IDENTITY_HTTP_PORT`, `SOCIAL_HTTP_PORT`, `CHAT_HTTP_PORT`, `NOTIFICATION_HTTP_PORT`                                                                                                                                        |
|                |                                                                                                                                                                                                                                                       |

## Chạy backend

Chạy từng service trong terminal riêng:

```bash
cd backend
dotnet build Connectly.Backend.slnx

dotnet run --project src/Services/Identity/Identity.API
dotnet run --project src/Services/Social/Social.API
dotnet run --project src/Services/Chat/Chat.API
dotnet run --project src/Services/Notification/Notification.API
dotnet run --project src/ApiGateways/YarpApiGateway
```

Hoặc chạy tất cả cùng lúc trên Windows:

```powershell
cd backend
.\run-all.ps1
```

Gateway chuyển tiếp và bỏ tiền tố, nên `http://localhost:5000/identity/api/v1/auth/login` được gọi tới Identity ở `http://localhost:5201/api/v1/auth/login`.

## Chạy frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

Mở `http://localhost:3000`. Kiểm tra kiểu và build:

```bash
pnpm run build
```

## Sự kiện RabbitMQ

| Routing key                          | Bên phát | Bên nhận                                      |
| ------------------------------------ | ---------- | ----------------------------------------------- |
| `identity.user-registered.v1`      | Identity   | Social tạo hồ sơ                             |
| `social.friend-request-created.v1` | Social     | Notification                                    |
| `social.friendship-accepted.v1`    | Social     | Notification                                    |
| `social.user-followed.v1`          | Social     | Notification                                    |
| `social.user-blocked.v1`           | Social     | Chat, ghi bản chiếu cặp bị chặn            |
| `social.user-unblocked.v1`         | Social     | Chat, xoá bản chiếu                          |
| `social.comment-created.v1`        | Social     | Notification                                    |
| `social.reaction-changed.v1`       | Social     | Notification                                    |
| `social.post-shared.v1`            | Social     | Notification                                    |
| `social.group-join-requested.v1`   | Social     | Notification                                    |
| `social.group-member-joined.v1`    | Social     | Notification                                    |
| `social.poll-voted.v1`             | Social     | Notification                                    |
| `social.story-viewed.v1`           | Social     | Notification                                    |
| `social.user-mentioned.v1`         | Social     | Notification                                    |
| `social.post-published.v1`         | Social     | Chưa có consumer, để dành cho fan-out feed |
| `social.post-deleted.v1`           | Social     | Chưa có consumer                              |

## API

Đường dẫn đầy đủ đi qua gateway, ví dụ `/social/api/v1/feed/home`. Danh sách route nằm trong các file `Endpoints` của từng service.

- Identity: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /me`, `GET|PUT /me/preferences`, `GET /security/sessions`, `POST /security/sessions/revoke`
- Social: hồ sơ và quyền riêng tư, bạn bè, theo dõi, chặn, tắt tiếng, media, bài viết, bình luận, cảm xúc, chia sẻ, bookmark, bình chọn, mention, hashtag, feed, nhóm, sự kiện, trang, story, highlight, reel, tìm kiếm
- Chat: `POST hoặc GET /conversations`, tin nhắn, đính kèm, đã đọc, sửa, thu hồi, reaction, presence, cài đặt nhận tin
- Notification: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`

Hub SignalR: `/hubs/chat` ở cổng 5203 và `/hubs/notifications` ở cổng 5204. Cả hai nhận access token qua query `access_token` hoặc header `Authorization`.

## Tài liệu

- `docs/runbook.md`: ghi chú vận hành
