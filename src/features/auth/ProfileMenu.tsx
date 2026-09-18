import * as Popover from '@radix-ui/react-popover';
import { Link } from 'react-router-dom';
import { LogOut, Smartphone, User } from 'lucide-react';
import { Avatar } from '../../components/ui';
import { roleLabel } from '../../lib/labels';
import { useSession } from './session';
import { signOut } from './api';

export default function ProfileMenu() {
  const { profile } = useSession();
  if (!profile) return null;

  const name = profile.full_name || 'Mitglied';

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Profilmenü"
          className="flex min-h-touch items-center gap-2 rounded-xl px-1 hover:bg-gray-50"
        >
          <span className="hidden text-right sm:block">
            <span className="block text-xs font-bold leading-tight text-gray-800">{name}</span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-primary">
              {roleLabel(profile.role)}
            </span>
          </span>
          <Avatar name={name} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
        >
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-500">{roleLabel(profile.role)}</p>
            {profile.qttr != null && (
              <p className="mt-0.5 text-xs tabular-nums text-gray-500">{profile.qttr} QTTR</p>
            )}
          </div>

          <Link
            to="/profile"
            className="flex min-h-touch items-center gap-2 rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            Mein Profil
          </Link>

          <Link
            to="/mobile-app"
            className="flex min-h-touch items-center gap-2 rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            App aufs Handy
          </Link>

          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-touch w-full items-center gap-2 rounded-lg px-3 text-sm text-gray-700 hover:bg-status-no-soft hover:text-danger"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Abmelden
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
