# Social API

Tiền tố qua gateway: `/social/api/v1`. Mọi route đều cần Bearer.

## Hồ sơ và quan hệ

| Nhóm | Route |
|---|---|
| Hồ sơ | `GET /me/profile`, `PATCH /me/profile`, `PATCH /me/profile/avatar`, `PATCH /me/profile/cover`, `GET /profiles/{userId}` |
| Danh sách | `GET /profiles/{userId}/friends`, `/followers`, `/following` |
| Quan hệ | `GET /users/{userId}/relationship` |
| Riêng tư | `GET /me/privacy`, `PUT /me/privacy` |
| Kết bạn | `POST /friend-requests`, `GET /friend-requests/received`, `/sent`, `POST /friend-requests/{id}/accept`, `/decline`, `DELETE /friend-requests/{id}`, `DELETE /friends/{userId}` |
| Theo dõi | `POST /users/{userId}/follow`, `DELETE /users/{userId}/follow` |
| Chặn và tắt tiếng | `POST|DELETE /users/{userId}/block`, `/mute` |
| Tra cứu | `GET /profiles/by-username/{username}`, `GET /users/by-username`, `GET /search` |

Quyền xem từng trường được xét theo quan hệ giữa người xem và chủ hồ sơ.

## Bài viết và tương tác

| Nhóm | Route |
|---|---|
| Media | `POST /media/uploads`, `POST /media/uploads/{mediaId}/complete` |
| Bài viết | `POST /posts`, `GET|PATCH|DELETE /posts/{postId}`, `POST /posts/{postId}/publish` |
| Bình luận | `POST|GET /posts/{postId}/comments`, `PATCH|DELETE /comments/{commentId}`, `PUT|DELETE /comments/{commentId}/reaction` |
| Lịch sử sửa | `GET /posts/{postId}/edits`, `GET /comments/{commentId}/edits` |
| Cảm xúc | `PUT|DELETE /posts/{postId}/reaction`, `GET /posts/{postId}/reactions` |
| Chia sẻ và lưu | `POST /posts/{postId}/share`, `PUT|DELETE /posts/{postId}/bookmark`, `GET /me/bookmarks` |
| Bình chọn | `PUT|DELETE /posts/{postId}/poll/vote` |

## Bảng tin

`GET /feed/home`, `GET /feed/hashtag/{tag}`, `GET /users/{userId}/posts`, `GET /groups/{groupId}/posts`, `GET /pages/{pageId}/posts`. Tất cả nhận `cursor` và `limit`.

## Cộng đồng

| Nhóm | Route |
|---|---|
| Nhóm | `POST|GET /groups`, `GET /groups/mine`, `GET|PATCH|DELETE /groups/{groupId}`, `POST|DELETE /groups/{groupId}/join` |
| Thành viên | `GET /groups/{groupId}/members`, `POST /groups/{groupId}/members/{userId}/approve`, `DELETE /groups/{groupId}/members/{userId}` |
| Sự kiện | `POST|GET /events`, `GET|PATCH|DELETE /events/{eventId}`, `PUT /events/{eventId}/rsvp`, `GET /events/{eventId}/attendees` |
| Trang | `POST|GET /pages`, `GET /pages/mine`, `GET|PATCH|DELETE /pages/{pageId}`, `GET|POST|DELETE /pages/{pageId}/admins` |

## Story, highlight và reel

`POST /stories`, `GET /stories/feed`, `GET /stories/{storyId}`, `POST /stories/{storyId}/view`, `PUT|DELETE /stories/{storyId}`, `GET /stories/{storyId}/views`, `POST /highlights`, `GET /highlights/mine`, `GET /highlights/{ownerUserId}`, `GET /highlights/{highlightId}/stories`, `POST|DELETE /highlights/{highlightId}/stories/{storyId}`, `POST /reels`, `GET /reels`, `GET /reels/{reelId}`, `POST /reels/{reelId}/view`.
