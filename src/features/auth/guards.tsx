import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useSession } from './session';
import { EmptyState, Button } from '../../components/ui';
import { signOut } from './api';
import type { Role } from '../../app/nav';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div
        role="status"
        aria-label="Lädt"
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary"
      />
    </div>
  );
}

/**
 * Lässt nur angemeldete, freigeschaltete Mitglieder durch.
 *
 * Wer auf Freischaltung wartet, bekommt eine eigene Seite statt einer leeren Anwendung —
 * sonst sähe es wie ein Fehler aus.
 */
export function RequireAuth() {
  const { session, profile, loading } = useSession();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profile && profile.status === 'pending_approval') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <EmptyState
          icon={Clock}
          title="Dein Zugang wartet auf Freischaltung"
          description="Ein Administrator des Vereins muss dich noch freischalten. Du bekommst eine E-Mail, sobald es soweit ist."
          action={
            <Button onClick={() => void signOut()}>Abmelden</Button>
          }
        />
      </div>
    );
  }

  if (profile && profile.deleted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <EmptyState
          title="Dieses Konto wurde gelöscht"
          description="Wenn das ein Versehen war, melde dich bitte beim Administrator des Vereins."
          action={<Button onClick={() => void signOut()}>Abmelden</Button>}
        />
      </div>
    );
  }

  return <Outlet />;
}

/** Schützt Routen, die nur bestimmte Rollen sehen dürfen. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { role, loading } = useSession();

  if (loading) return <FullPageSpinner />;
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
