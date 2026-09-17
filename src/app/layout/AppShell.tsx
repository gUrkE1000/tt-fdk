import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomBar from './BottomBar';
import { labelForPath, type Role } from '../nav';
import { useSession } from '../../features/auth/session';
import ProfileMenu from '../../features/auth/ProfileMenu';
import { usePublicClubInfo } from '../../features/auth/api';

interface AppShellProps {
  /** Nur für Tests: überschreibt Rolle und Vereinsname statt der echten Sitzung. */
  role?: Role | null;
  clubName?: string;
  headerActions?: React.ReactNode;
}

/**
 * Grundgerüst der Anwendung: feste Seitenleiste ab xl, darunter Kopfzeile mit Hamburger,
 * Drawer und Bottom-Bar (Zielbild 6.2).
 */
export default function AppShell({ role, clubName, headerActions }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const session = useSession();
  const clubInfo = usePublicClubInfo();

  const effectiveRole = role !== undefined ? role : session.role;
  const effectiveClubName = clubName ?? clubInfo.data?.club_name ?? 'Vereinsplaner';

  // Beim Seitenwechsel schließt der Drawer, sonst bliebe er nach einem Klick offen.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden xl:block">
        <Sidebar role={effectiveRole} clubName={effectiveClubName} />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="absolute inset-0 bg-gray-900/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex">
            <Sidebar
              role={effectiveRole}
              clubName={effectiveClubName}
              onNavigate={() => setDrawerOpen(false)}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Menü schließen"
              className="m-2 flex h-10 w-10 items-center justify-center self-start rounded-xl bg-white text-gray-600"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={labelForPath(location.pathname)}
          onOpenMenu={() => setDrawerOpen(true)}
          actions={headerActions ?? <ProfileMenu />}
        />

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-4 sm:px-6 sm:py-6">
          <Outlet />
        </main>

        <BottomBar role={effectiveRole} onOpenMenu={() => setDrawerOpen(true)} />
      </div>
    </div>
  );
}
