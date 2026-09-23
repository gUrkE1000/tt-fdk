import { NavLink } from 'react-router-dom';
import { visibleNav, type Role } from '../nav';
import NavBadge from './NavBadge';

interface SidebarProps {
  role: Role | null;
  clubName: string;
  /** Wird auf dem Smartphone nach jedem Klick aufgerufen, um den Drawer zu schließen. */
  onNavigate?: () => void;
  /** Zähler je Ziel, z. B. offene Rückmeldungen an „Übersicht". */
  badges?: Record<string, number>;
}

export default function Sidebar({ role, clubName, onNavigate, badges }: SidebarProps) {
  const sections = visibleNav(role);

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-4">
        <span className="text-2xl" aria-hidden="true">
          🏓
        </span>
        <span className="truncate text-sm font-bold text-gray-900">{clubName}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.section ?? 'start'} className="mb-5 last:mb-0">
            {section.section && (
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {section.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      [
                        'flex min-h-touch items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary-soft text-primary'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      ].join(' ')
                    }
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                    <NavBadge count={badges?.[item.to]} className="ml-auto" />
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
