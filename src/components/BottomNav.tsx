import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Today', end: true },
  { to: '/log', label: 'Log', end: false },
  { to: '/program', label: 'Plan', end: false },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/review', label: 'Review', end: false },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700 bg-ink-800/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex h-14 items-center justify-center text-sm font-medium transition ${
                  isActive ? 'text-accent' : 'text-slate-400'
                }`
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
