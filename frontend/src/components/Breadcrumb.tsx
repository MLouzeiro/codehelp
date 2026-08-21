import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { findActiveItem } from '../config/navigation';

interface Crumb {
  label: string;
  path: string | null;
}

function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Dashboard', path: '/app/dashboard' }];
  const active = findActiveItem(pathname);

  if (active) {
    if (active.group.label !== 'Dashboard') {
      crumbs.push({ label: active.group.label, path: null });
    }
    if (active.parent && active.parent.path !== active.item.path) {
      crumbs.push({ label: active.parent.label, path: active.parent.path });
    }
    crumbs.push({ label: active.item.label, path: active.item.path });
    return crumbs;
  }

  // Fallback: rota de detalhe sem match exato (ex: /app/crm/123, /app/orders/abc)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const appIdx = segments.indexOf('app');
    const rest = appIdx >= 0 ? segments.slice(appIdx + 1) : [];
    if (rest.length > 1) {
      crumbs.push({ label: rest.join(' / '), path: null });
    }
  }

  return crumbs;
}

export default function Breadcrumb() {
  const location = useLocation();
  const crumbs = useMemo(() => buildCrumbs(location.pathname), [location.pathname]);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4 flex-wrap" style={{ fontFamily: 'Lexend, sans-serif' }}>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />}
          {i === 0 && <Home size={12} className="text-slate-400" />}
          {c.path && i < crumbs.length - 1 ? (
            <Link to={c.path} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{c.label}</Link>
          ) : (
            <span className={i === crumbs.length - 1 ? 'text-slate-700 dark:text-slate-200 font-medium' : ''}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
