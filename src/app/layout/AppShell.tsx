import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomBar from './BottomBar';
import { labelForPath, type Role } from '../nav';

interface AppShellProps {
  /** Wird in 1.4 durch die echte Sitzung ersetzt. */
  role?: Role | null;
  clubName?: string;
}

/**
 * Grundgerüst der Anwendung: feste Seitenleiste ab xl, darunter Kopfzeile mit Hamburger,
 * Drawer und Bottom-Bar (Zielbild 6.2).
 */
export default function AppShell({ role = 'admin', clubName = 'Vereinsplaner' }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Beim Seitenwechsel schließt der Drawer, sonst bliebe er nach einem Klick offen.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Escape schließt den Drawer.
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
      {/* Desktop: feste Seitenleiste */}
      <div className="hidden xl:block">
        <Sidebar role={role} clubName={clubName} />
      </div>

      {/* Smartphone/Tablet: Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="absolute inset-0 bg-gray-900/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex">
            <Sidebar role={role} clubName={clubName} onNavigate={() => setDrawerOpen(false)} />
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
        <Header title={labelForPath(location.pathname)} onOpenMenu={() => setDrawerOpen(true)} />

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-4 sm:px-6 sm:py-6">
          <Outlet />
        </main>

        <BottomBar role={role} onOpenMenu={() => setDrawerOpen(true)} />
      </div>
    </div>
  );
}
