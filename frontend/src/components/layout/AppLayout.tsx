import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNavbar from '@/components/layout/TopNavbar';
import AppSidebar from '@/components/layout/AppSidebar';
import { ToastContainer } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { loadServerTheme } from '@/lib/theme';
import Overlay from '@/components/ui/overlay';

/* The chat dock is the heaviest thing in the shell, and most visitors never
   open it. Loading it as its own chunk keeps it out of the first paint. */
const ChatDock = lazy(() => import('@/features/chat/ChatDock'));

/**
 * Placeholder for a route whose chunk is still downloading. Static blocks
 * rather than a spinner: the device is already busy fetching, and an
 * animation on top of that only steals frames from the download.
 */
function RouteFallback() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-6 w-40 rounded bg-secondary" />
      <div className="h-4 w-64 max-w-full rounded bg-secondary" />
      <div className="h-64 w-full rounded border border-border bg-card" />
    </div>
  );
}

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();

  // The theme is a per-user setting; adopt the saved value once the session is authenticated.
  useEffect(() => {
    loadServerTheme().catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <TopNavbar onMenuClick={() => setMobileNavOpen(true)} />

      {/* Dim overlay behind the mobile drawer */}
      {mobileNavOpen && (
        <Overlay
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

