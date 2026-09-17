import { Menu } from 'lucide-react';

interface HeaderProps {
  title: string;
  onOpenMenu: () => void;
  /** Rechts in der Kopfzeile: Glocke und Profilmenü (ab Phase 4 bzw. 1.4). */
  actions?: React.ReactNode;
}

export default function Header({ title, onOpenMenu, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Menü öffnen"
          className="-ml-1 flex min-h-touch min-w-touch items-center justify-center rounded-xl text-gray-600 hover:bg-gray-50 xl:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <h1 className="flex-1 truncate text-lg font-bold text-gray-900">{title}</h1>

        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
