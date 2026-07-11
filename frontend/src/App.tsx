import { lazy } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import { useAppSelector } from '@/store/hooks';

/*
  Every page is a separate chunk. A visitor who opens the feed should not
  download the reels player, the groups screen and the settings page before
  the first post can render — on a low-end device that wait is the difference
  between "the app feels slow" and "the app feels broken".
*/
const HomePage = lazy(() => import('@/features/home/HomePage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const MessagesPage = lazy(() => import('@/features/chat/MessagesPage'));
const ExplorePage = lazy(() => import('@/features/explore/ExplorePage'));
const BookmarksPage = lazy(() => import('@/features/bookmarks/BookmarksPage'));
const MemoriesPage = lazy(() => import('@/features/memories/MemoriesPage'));
const FriendsPage = lazy(() => import('@/features/friends/FriendsPage'));
const PostPage = lazy(() => import('@/features/post/PostPage'));
const HashtagPage = lazy(() => import('@/features/hashtag/HashtagPage'));
const GroupsPage = lazy(() => import('@/features/groups/GroupsPage'));
const GroupDetailPage = lazy(() => import('@/features/groups/GroupDetailPage'));
const EventsPage = lazy(() => import('@/features/events/EventsPage'));
const PagesPage = lazy(() => import('@/features/pages/PagesPage'));
const PageDetailPage = lazy(() => import('@/features/pages/PageDetailPage'));
const ReelsPage = lazy(() => import('@/features/reels/ReelsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const SearchPage = lazy(() => import('@/features/search/SearchPage'));

function RequireAuth() {
  const token = useAppSelector((state) => state.auth.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function PublicOnly() {
  const token = useAppSelector((state) => state.auth.token);
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:userId" element={<ProfilePage />} />
          <Route path="post/:postId" element={<PostPage />} />
          <Route path="hashtag/:tag" element={<HashtagPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="groups/:groupId" element={<GroupDetailPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="pages" element={<PagesPage />} />
          <Route path="pages/:pageId" element={<PageDetailPage />} />
          <Route path="reels" element={<ReelsPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="bookmarks" element={<BookmarksPage />} />
          <Route path="memories" element={<MemoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
