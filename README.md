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

## Hạ tầng

Bốn dịch vụ hạ tầng, mỗi thứ một nhà cung cấp khác nhau:

| | Cloud (`backend/.env`) | Local (`backend/.env.example`) |
|---|---|---|
| PostgreSQL | Aiven, `pg-7463afe-...a.aivencloud.com:27029` | `localhost:5432` |
| Redis | Aiven Valkey, `valkey-10904112-...a.aivencloud.com:27030` | `localhost:6379` |
| RabbitMQ | CloudAMQP, `chameleon-01.lmq.cloudamqp.com:5672` | `localhost:5672` |
| Object storage | Oracle Object Storage, endpoint kiểu S3 | SeaweedFS, `localhost:8333` |

Toàn bộ host, cổng và mật khẩu nằm trong `backend/.env`. Không có host nào được viết cứng trong code.

**Giới hạn connection của Aiven.** Gói Aiven cho phép 20 connection, 3 chỗ dành cho superuser, còn 17 dùng được. Npgsql mặc định mở pool tối đa 100 connection, mà dự án có 5 pool: Identity, Social, Chat, Notification và một pool của Hangfire nằm trong Social. Không giới hạn thì database chết ngay với lỗi `remaining connection slots are reserved`. Vì vậy `backend/.env` để `POSTGRES_MAX_POOL_SIZE=3`, còn `backend/.env.example` để 10 vì local chịu được nhiều hơn.

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

`deploy/docker/initdb/01-create-dbs.sh` còn trong repo nhưng thuộc kiến trúc cũ bốn database, các service hiện tại không dùng tới.

Repo chưa đóng gói sẵn file compose. Mỗi service có Dockerfile riêng trong thư mục project.

## Cơ sở dữ liệu

Một database duy nhất, `connectly-social-db`, chia thành năm schema. Mỗi service khai báo `HasDefaultSchema` nên bảng của nó nằm đúng schema tương ứng:

| Schema | Nội dung |
|---|---|
| `identity` | user, refresh token, tuỳ chọn giao diện |
| `social` | hồ sơ, quan hệ, bài viết, bình luận, cảm xúc, nhóm, sự kiện, trang, story, reel, media |
| `chat` | hội thoại, tin nhắn, reaction, cài đặt nhận tin |
| `notification` | hộp thư thông báo |
| `hangfire` | bảng của Hangfire, khai báo bằng `SchemaName = "hangfire"` trong cấu hình storage |

Ba view phụ trợ: `social.user_with_profile`, `notification.unread_counts` và `chat.conversation_with_last_message`.

Service đăng nhập bằng user của host, trên Aiven là `avnadmin`. Role `connectly` do script dựng database tạo ra, mang quyền cho các bảng, không dùng để đăng nhập.

### Dựng lại database

`template-database/connectly-social-db.sql` dựng database từ đầu. Các bước nó thực hiện:

1. Tạo role `connectly` nếu chưa có.
2. Xoá và tạo lại database `connectly-social-db`.
3. Dựng 5 schema, 68 bảng, 3 view, kèm index và constraint.
4. Nạp dữ liệu mẫu.
5. Cấp quyền cho `connectly`.

Chạy nó cần psql 18 trở lên, vì file dùng `\connect`, `\if`, `\gexec` và `\restrict`:

```bash
psql -h HOST -p PORT -U USER -d defaultdb -f template-database/connectly-social-db.sql
```

Ba tham số đổi được bằng `-v`:

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `db_name` | `connectly-social-db` | database cần dựng lại |
| `maintenance_db` | `defaultdb` | database dùng để chạy `DROP DATABASE` và `CREATE DATABASE` |
| `app_role` | `connectly` | role mang quyền cho service |

Script xoá sạch database cũ trước khi dựng, nên mỗi lần chạy đều mất dữ liệu đang có. Script tự đóng các session còn treo nên không cần dừng service trước, nhưng service đang chạy sẽ phải kết nối lại.

### Migration của Entity Framework

20 migration được chia theo schema, và script ghi sẵn vào bảng `__EFMigrationsHistory` của từng schema:

| Schema | Số migration |
|---|---|
| `identity` | 3 |
| `social` | 11 |
| `chat` | 4 |
| `notification` | 2 |

Nhờ vậy `MIGRATE_ON_STARTUP=true` không chạy lại những migration đã nằm sẵn trong schema.

## Cấu hình

Sao chép `backend/.env.example` thành `backend/.env` rồi chỉnh theo máy đang chạy. Service tự dò file `.env` ngược từ thư mục làm việc lên trên, nên chạy từ đâu trong `backend/` cũng đọc được. Biến môi trường đã tồn tại luôn được ưu tiên hơn giá trị trong file.

Các nhóm biến chính:

| Nhóm | Biến |
|---|---|
| PostgreSQL | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `POSTGRES_SSL_MODE`, `POSTGRES_MAX_POOL_SIZE` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_SSL` |
| RabbitMQ | `RABBIT_HOST`, `RABBIT_PORT`, `RABBIT_USER`, `RABBIT_PASSWORD`, `RABBIT_VHOST`, `RABBIT_EVENT_EXCHANGE` |
| Object storage | `SEAWEED_S3_ENDPOINT`, `SEAWEED_S3_ACCESS_KEY`, `SEAWEED_S3_SECRET_KEY`, `SEAWEED_S3_BUCKET`, `SEAWEED_S3_UPLOAD_URL_TTL_MINUTES` |
| Xác thực | `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TOKEN_TTL_MINUTES`, `JWT_REFRESH_TOKEN_TTL_DAYS` |
| Cổng | `GATEWAY_PORT`, `IDENTITY_HTTP_PORT`, `SOCIAL_HTTP_PORT`, `CHAT_HTTP_PORT`, `NOTIFICATION_HTTP_PORT` |
| Vận hành | `MIGRATE_ON_STARTUP`, `HANGFIRE_ENABLED`, `CORS_ORIGIN`, `INTERNAL_API_KEY` |
| Chat | `CHAT_EDIT_WINDOW_MINUTES`, `CHAT_UNSEND_WINDOW_MINUTES` |

Biến của frontend nằm riêng trong `frontend/.env`, xem `frontend/README.md`.

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

Script ghi log vào `backend/logs/`, lưu PID vào `backend/.run/pids.json` và kiểm tra lại bằng `netstat`. Dừng bằng `.\stop-all.ps1`.

Khi `MIGRATE_ON_STARTUP=true`, mỗi service tự chạy migration còn thiếu lúc khởi động. Mặc định để `false` để tránh sửa schema ngoài ý muốn.

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

## Thiết kế đáng chú ý

**Xác thực.** Mật khẩu băm bằng PBKDF2-SHA256, 100.000 vòng, salt ngẫu nhiên cho từng người dùng. Access token là JWT ký HMAC-SHA256. Refresh token là chuỗi 64 byte ngẫu nhiên, chỉ lưu hash SHA256 trong database và được xoay vòng mỗi lần làm mới. Mỗi lần đăng nhập ghi thêm thông tin thiết bị, IP và vị trí ước lượng để trang bảo mật hiển thị và thu hồi phiên.

**Outbox.** Dữ liệu nghiệp vụ và sự kiện được ghi trong cùng một transaction. Một background service quét bảng `outbox_messages` rồi publish lên RabbitMQ. Phía nhận ghi `inbox_messages` theo `EventId` trong cùng transaction với việc xử lý, nhờ vậy consumer chạy lại vẫn không sinh dữ liệu trùng. Message lỗi bị `nack` không requeue để rơi vào DLQ.

**Phân quyền phía server.** Quyền xem hồ sơ được xét theo từng trường và theo quan hệ giữa hai người (chủ sở hữu, bạn bè, bạn của bạn, người lạ). Bài viết kiểm tra visibility, tư cách thành viên nhóm và quyền quản trị trang trước khi trả nội dung. Chặn sẽ xoá bạn bè và theo dõi hai chiều.

**Tải media hai bước.** Social cấp presigned PUT để client đẩy file thẳng lên object storage, sau đó client gọi endpoint complete để đánh dấu `MediaAsset` sẵn sàng. Object key do `StoraLayout` sinh theo loại media, thời gian và uuid. Job Hangfire hằng ngày chuyển các media treo quá 24 giờ sang trạng thái bỏ dở.

**Chat.** Tin nhắn đi qua REST rồi được đẩy tiếp bằng SignalR. Sửa trong 15 phút, thu hồi không giới hạn theo mặc định, cả hai mốc đọc từ biến môi trường. Presence lưu trên Redis với TTL 90 giây và vòng keep-alive 40 giây. Chat giữ bản chiếu riêng của cặp người dùng bị chặn, cập nhật từ sự kiện Social nên không cần đọc chéo schema.

**Frontend.** Axios gắn Bearer và `X-Device-Id`, khi gặp 401 thì gọi endpoint refresh một lần và xếp hàng các request đang chờ. Theme lưu ở localStorage và đồng bộ lên server. Sidebar thu thành drawer ở màn hình nhỏ, right rail chỉ hiện từ breakpoint `xl`.

## Sự kiện RabbitMQ

Exchange topic `connectly.events`, routing key theo dạng `{domain}.{tên}.v{n}`. Mỗi consumer có queue riêng `connectly.{service}.{eventType}`.

| Routing key | Bên phát | Bên nhận |
|---|---|---|
| `identity.user-registered.v1` | Identity | Social tạo hồ sơ |
| `social.friend-request-created.v1` | Social | Notification |
| `social.friendship-accepted.v1` | Social | Notification |
| `social.user-followed.v1` | Social | Notification |
| `social.user-blocked.v1` | Social | Chat, ghi bản chiếu cặp bị chặn |
| `social.user-unblocked.v1` | Social | Chat, xoá bản chiếu |
| `social.comment-created.v1` | Social | Notification |
| `social.reaction-changed.v1` | Social | Notification |
| `social.post-shared.v1` | Social | Notification |
| `social.group-join-requested.v1` | Social | Notification |
| `social.group-member-joined.v1` | Social | Notification |
| `social.poll-voted.v1` | Social | Notification |
| `social.story-viewed.v1` | Social | Notification |
| `social.user-mentioned.v1` | Social | Notification |
| `social.post-published.v1` | Social | Chưa có consumer, để dành cho fan-out feed |
| `social.post-deleted.v1` | Social | Chưa có consumer |
| `chat.message-sent.v1` | Chat | Chưa dùng |
| `chat.conversation-created.v1` | Chat | Chưa dùng |

## API

Đường dẫn đầy đủ đi qua gateway, ví dụ `/social/api/v1/feed/home`. Danh sách route nằm trong các file `Endpoints` của từng service.

- Identity: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /me`, `GET|PUT /me/preferences`, `GET /security/sessions`, `POST /security/sessions/revoke`
- Social: hồ sơ và quyền riêng tư, bạn bè, theo dõi, chặn, tắt tiếng, media, bài viết, bình luận, cảm xúc, chia sẻ, bookmark, bình chọn, mention, hashtag, feed, nhóm, sự kiện, trang, story, highlight, reel, tìm kiếm
- Chat: `POST|GET /conversations`, tin nhắn, đính kèm, đã đọc, sửa, thu hồi, reaction, presence, cài đặt nhận tin
- Notification: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`

Hub SignalR: `/hubs/chat` ở cổng 5203 và `/hubs/notifications` ở cổng 5204. Cả hai nhận access token qua query `access_token` hoặc header `Authorization`.

## Công cụ và kiểm thử

```bash
cd backend
dotnet build Connectly.Backend.slnx

# thêm migration mới
dotnet dotnet-ef migrations add TenMigration -p src/Services/Social/Social.API -s src/Services/Social/Social.API
```

Backend chưa có project kiểm thử nào. Phía frontend dùng Storybook kèm vitest và playwright để chạy story trong trình duyệt thật, hiện có 5 story cho nhóm component UI. `frontend/scripts/` giữ ba script playwright để duyệt app bằng tay: một script kiểm tra các tính năng chat mới, một script quét các trang trong app với phiên giả, một script kiểm tra trang đăng nhập.

Việc cần làm tiếp là integration test cho luồng đăng ký, luồng đăng bài kèm media và luồng gửi tin nhắn, cùng với việc bổ sung compose cho môi trường dev.

## Tài liệu

- `docs/concepts/Social_Network_Product_Blueprint_V3_VI.md`: bản thiết kế sản phẩm và nghiệp vụ
- `docs/concepts/social_huong_dan.md`: hướng dẫn triển khai miền Social
- `docs/adr/`: các quyết định kiến trúc
- `docs/api/`: mô tả endpoint từng service
- `docs/runbook.md`: ghi chú vận hành
