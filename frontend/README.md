# connectly-web

Giao diện web của Connectly. React 18, TypeScript, Vite, Tailwind, Redux Toolkit và SignalR.

## Chạy dev

```bash
cd frontend
pnpm install
pnpm run dev
```

Mặc định mở ở `http://localhost:3000`, đổi bằng biến `VITE_PORT`.

## Biến môi trường

Chép `.env.example` thành `.env` nếu cần dựng lại. Vite không nội suy biến trong file `.env`, mọi giá trị phải ghi trực tiếp.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | Địa chỉ gateway, dùng cho axios và các API Social, Chat, Notification |
| `VITE_IDENTITY_API_URL` | `http://localhost:5000/identity/api/v1` | Địa chỉ Identity, dùng cho đăng nhập, làm mới token và quản lý phiên |
| `VITE_CHAT_HUB_URL` | `http://localhost:5203/hubs/chat` | Hub SignalR của Chat |
| `VITE_NOTIFICATION_HUB_URL` | `http://localhost:5204/hubs/notifications` | Hub SignalR của Notification |
| `VITE_PORT` | `3000` | Cổng dev server |

## Script

```bash
pnpm run dev      # chạy dev server
pnpm run build    # kiểm tra kiểu bằng tsc rồi build production
pnpm run preview  # xem bản build
```

## Cấu trúc

```text
src/
  App.tsx                 khai báo route công khai và route cần đăng nhập
  index.css               token màu, bán kính, chế độ sáng tối
  main.tsx                nạp theme, Redux Provider, Router
  components/
    layout/               khung ứng dụng: navbar, sidebar, right rail, tìm kiếm, logo
    ui/                   component dùng lại: button, input, card, avatar, dialog
  features/
    auth/                 đăng nhập, đăng ký
    home/                 bảng tin, story rail, composer
    social/               thẻ bài viết, bình luận, reaction, chia sẻ, mention
    stories/              đăng story, xem story, highlight
    reels/                feed reel, trình phát, dialog tạo reel
    chat/                 trang nhắn tin và dock chat nổi
    notifications/        hộp thư thông báo
    friends/ groups/ events/ pages/ profile/ settings/ search/ bookmarks/ memories/ hashtag/
  lib/
    api.ts                axios, gắn token và X-Device-Id, tự làm mới khi 401
    social.ts             toàn bộ lời gọi API Social, Chat, Notification
    hubs.ts               tạo kết nối SignalR có tự kết nối lại
    presence.ts           lấy trạng thái online và sinh nhãn thời gian
    security.ts           liệt kê và thu hồi phiên đăng nhập
    theme.ts              đọc ghi theme, đồng bộ lên server
  store/
    authSlice.ts          trạng thái đăng nhập, persist vào connectly.auth
    device.ts             device id và token đã lưu
  types/                  DTO khớp với backend
```

## Luồng đăng nhập

`authSlice` gọi thẳng `POST /auth/login` hoặc `/auth/register`, lưu access token, refresh token và thông tin người dùng vào localStorage theo khoá `connectly.auth`. Mỗi request sau đó được axios gắn header `Authorization` và `X-Device-Id` lấy từ `connectly.device`.

Khi server trả 401, `lib/api.ts` gọi `POST /auth/refresh` đúng một lần. Các request cùng lúc được giữ lại và chạy tiếp sau khi có token mới. Nếu làm mới thất bại thì xoá phiên và chuyển về `/login`.

## Realtime

`lib/hubs.ts` tạo kết nối SignalR tới hub theo URL truyền vào, đăng ký `accessTokenFactory` và `withAutomaticReconnect`. Trang `MessagesPage` và `ChatDock` lắng nghe `message-received`, `message-read`, `message-updated`, `message-deleted`, `message-reaction`, `presence-updated`, `typing`. Hộp thư thông báo hiện đọc qua REST và tải lại định kỳ; hub thông báo đã có sẵn địa chỉ để nối tiếp.

