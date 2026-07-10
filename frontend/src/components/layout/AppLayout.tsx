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

      {/* Docked left rail (desktop) / drawer (mobile) */}
      <AppSidebar
        className={cn(
          'fixed bottom-0 left-0 top-14 z-50 w-[264px] transition-transform duration-200',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
        onNavigate={() => setMobileNavOpen(false)}
      />

      {/* Content panel — offset by the docked left rail */}
      <div className="lg:pl-[264px]">
        <main className="min-w-0 px-4 py-6 lg:px-6">
          {/* One content width for every page: no per-route special cases, so
              pages never need to guess how wide they are allowed to be. */}
          <div className="mx-auto w-full max-w-[1120px] pb-12">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Floating chat dock — available on every page except Messages itself */}
      <Suspense fallback={null}>
        <ChatDock />
      </Suspense>

      {/* Global toast notifications */}
      <ToastContainer position="top-right" />
    </div>
  );
}
