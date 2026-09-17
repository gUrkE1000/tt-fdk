import { NavLink } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { primaryNav, type Role } from '../nav';

interface BottomBarProps {
  role: Role | null;
  onOpenMenu: () => void;
}

/**
 * Bottom-Bar für das Smartphone: die drei bis vier häufigsten Ziele plus „Mehr",
 * das den Drawer mit der vollständigen Navigation öffnet.
 */
export default function BottomBar({ role, onOpenMenu }: BottomBarProps) {
  const items = primaryNav(role).slice(0, 4);

  return (
    <nav
      aria-label="Schnellzugriff"
      className="sticky bottom-0 z-30 grid grid-cols-5 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] xl:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            [
              'flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-gray-500',
            ].join(' ')
          }
        >
          <item.icon className="h-5 w-5" aria-hidden="true" />
          <span className="truncate px-1">{item.label}</span>
        </NavLink>
      ))}

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-gray-500"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        <span>Mehr</span>
      </button>
    </nav>
  );
}
