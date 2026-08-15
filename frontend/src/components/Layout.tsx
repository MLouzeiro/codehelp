import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { useThemeSettings } from '../services/ThemeContext';
import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Settings, LogOut, Menu, X, ChevronDown, Bell, Check, CheckCheck,
} from 'lucide-react';
import api from '../services/api';
import type { Notificacao } from '../types';
import { filterGroupsByRole, userHasRole } from '../config/navigation';
import Breadcrumb from './Breadcrumb';

const ThemeSettings = lazy(() => import('./ThemeSettings'));
const SearchBar = lazy(() => import('./SearchBar'));

export default function Layout() {
  const { user, logout } = useAuth();
  const { sidebarLayout, theme, toggleTheme } = useThemeSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);
  const sidebarHoverTimeout = useRef<ReturnType<typeof setTimeout>>();

  const isHorizontal = sidebarLayout === 'horizontal';
  const isCollapsed = sidebarLayout === 'collapsed';
  const isVertical = sidebarLayout === 'vertical';

  const groups = filterGroupsByRole(user?.role);

  // Determina grupos que devem abrir automaticamente (contêm a rota ativa)
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        const anyActive = g.items.some((i) => location.pathname === i.path || location.pathname.startsWith(i.path + '/'));
        if (anyActive) next.add(g.key);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const carregarNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notificacoes', { params: { limit: 10 } });
      setNotifs(data.items || []);
      setNaoLidas(data.naoLidas || 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    carregarNotifs();
    const id = setInterval(carregarNotifs, 30000);
    return () => clearInterval(id);
  }, [carregarNotifs]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  const marcarLida = async (id: string) => {
    try {
      await api.post(`/notificacoes/${id}/lida`);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
      setNaoLidas((c) => Math.max(0, c - 1));
    } catch {}
  };

  const marcarTodas = async () => {
    try {
      await api.post('/notificacoes/marcar-todas');
      setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch {}
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSidebarEnter = () => {
    if (sidebarHoverTimeout.current) clearTimeout(sidebarHoverTimeout.current);
    setSidebarHovered(true);
  };

  const handleSidebarLeave = () => {
    sidebarHoverTimeout.current = setTimeout(() => setSidebarHovered(false), 200);
  };

  const isItemActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const isGroupActive = (groupItems: { path: string }[]) => groupItems.some((i) => isItemActive(i.path));

  const iconClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-xl text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;

  const renderGroupItems = (groupItems: { path: string; label: string; icon: any; roles?: string[] }[], collapsed?: boolean) =>
    groupItems
      .filter((item) => userHasRole(user?.role, item.roles))
      .map((item) => {
        const active = isItemActive(item.path);
        return (
          <Link key={item.path} to={item.path}
            title={collapsed ? item.label : undefined}
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 min-h-[40px] rounded-xl text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setSidebarOpen(false)}
            style={{ fontFamily: 'Lexend, sans-serif', fontSize: collapsed ? '0.75rem' : '0.82rem', letterSpacing: '0.01em' }}>
            <item.icon size={collapsed ? 18 : 17} className={active ? 'text-blue-200' : ''} />
            {!collapsed && item.label}
          </Link>
        );
      });

  const SidebarContent = ({ collapsed }: { collapsed?: boolean }) => (
    <>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} h-16 px-5 border-b border-white/10`}>
        <Link to="/app/dashboard" className="flex items-center gap-2">
          <img src="/logo-codemed-horizontal.png" alt="Codemed" className={collapsed ? 'h-6 w-auto' : 'h-8 w-auto'} />
        </Link>
        {!collapsed && (
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className={`relative p-3 space-y-0.5 overflow-y-auto h-[calc(100%-4rem-3rem)] ${collapsed ? 'px-2' : ''}`}>
        {groups.map((group) => {
          const groupActive = isGroupActive(group.items);
          const open = openGroups.has(group.key);
          const visibleItems = group.items.filter((item) => userHasRole(user?.role, item.roles));
          if (visibleItems.length === 0) return null;

          // Dashboard e grupos com um único item renderizam direto (sem submenu)
          if (visibleItems.length === 1 && group.key !== 'gestao') {
            const item = visibleItems[0];
            const active = isItemActive(item.path);
            return (
              <Link key={group.key} to={item.path}
                title={collapsed ? item.label : undefined}
                className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 min-h-[40px] rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setSidebarOpen(false)}
                style={{ fontFamily: 'Lexend, sans-serif', fontSize: collapsed ? '0.75rem' : '0.82rem', letterSpacing: '0.01em' }}>
                <group.icon size={collapsed ? 18 : 17} className={active ? 'text-blue-200' : ''} />
                {!collapsed && group.label}
              </Link>
            );
          }

          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => { if (!collapsed) toggleGroup(group.key); }}
                title={collapsed ? group.label : undefined}
                className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 min-h-[40px] rounded-xl text-sm font-medium transition-all duration-200 ${
                  groupActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                style={{ fontFamily: 'Lexend, sans-serif', fontSize: collapsed ? '0.75rem' : '0.82rem', letterSpacing: '0.01em' }}>
                <group.icon size={collapsed ? 18 : 17} className={groupActive ? 'text-blue-200' : ''} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown size={15} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''} ${groupActive ? 'text-blue-200' : 'text-slate-500'}`} />
                  </>
                )}
              </button>
              {!collapsed && open && (
                <div className="ml-4 mt-0.5 pl-3 border-l border-white/10 space-y-0.5 animate-slide-down">
                  {renderGroupItems(visibleItems, collapsed)}
                </div>
              )}
            </div>
          );
        })}
        <div className="pt-3 mt-3 border-t border-white/10">
          {(user?.role === 'admin' || user?.role === 'gerente') && (
            <Link to="/app/settings"
              title={collapsed ? 'Configurações' : undefined}
              className={iconClass(location.pathname === '/app/settings')}
              onClick={() => setSidebarOpen(false)}
              style={{ fontFamily: 'Lexend, sans-serif', fontSize: collapsed ? '0.75rem' : '0.82rem', letterSpacing: '0.01em' }}>
              <Settings size={collapsed ? 18 : 17} />
              {!collapsed && 'Configurações'}
            </Link>
          )}
        </div>
      </nav>

      <div className="absolute bottom-50 left-0 right-0 p-4 border-t border-white/10">
        <div className={`flex items-center ${collapsed ? 'justify-center' : ''} gap-2 text-white/40 text-xs`} style={{ fontFamily: 'Lexend, sans-serif' }}>
          <LayoutDashboard size={12} />
          {!collapsed && 'Codemed Hub v1.0'}
        </div>
      </div>
    </>
  );

  const headerContent = (
    <>
      {!isHorizontal && !isCollapsed && (
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <Menu size={22} />
        </button>
      )}
      {isHorizontal && (
        <Link to="/app/dashboard" className="flex items-center gap-2 mr-4">
          <img src="/logo-codemed-horizontal.png" alt="Codemed" className="h-7 w-auto" />
        </Link>
      )}
      {isHorizontal && (
        <nav className="flex items-center gap-1 overflow-x-auto">
          {groups.map((group) => {
            const groupActive = isGroupActive(group.items);
            const visibleItems = group.items.filter((item) => userHasRole(user?.role, item.roles));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.key} className="relative group">
                <Link to={visibleItems[0].path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${groupActive ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <group.icon size={15} />
                  <span className="hidden xl:inline">{group.label}</span>
                  {visibleItems.length > 1 && <ChevronDown size={13} />}
                </Link>
                {visibleItems.length > 1 && (
                  <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-50">
                    <div className="w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5">
                      {renderGroupItems(visibleItems, false)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}
      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <Suspense fallback={<div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />}>
          <SearchBar compact />
        </Suspense>
      </div>
      <div className="flex-1" />
      <Suspense fallback={<div className="w-10 h-10" />}>
        <ThemeSettings />
      </Suspense>
      <div className="relative" ref={notifRef}>
        <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <Bell size={18} />
          {naoLidas > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-blue-600 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-slide-down">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-750">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Notificações</span>
              {naoLidas > 0 && (
                <button onClick={marcarTodas} className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 font-medium">
                  <CheckCheck size={11} /> Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Nenhuma notificação
                </div>
              ) : (
                notifs.map((n) => (
                  <div key={n.id}
                    onClick={() => !n.lida && marcarLida(n.id)}
                    className={`px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 cursor-pointer transition-colors ${n.lida ? 'opacity-60' : 'bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}>
                    <div className="flex items-start gap-2">
                      {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-200">{n.mensagem}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">{n.tipo}</span>
                          <span>{new Date(n.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      {n.lida && <Check size={12} className="text-slate-300 dark:text-slate-600 mt-1" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm" style={{ fontFamily: 'Khand, sans-serif' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block" style={{ fontFamily: 'Lexend, sans-serif' }}>{user?.name}</span>
          <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />
        </button>
        {userMenuOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-slide-down">
            <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700" style={{ fontFamily: 'Lexend, sans-serif' }}>{user?.email}</div>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" style={{ fontFamily: 'Lexend, sans-serif' }}>
              <LogOut size={16} /> Sair do sistema
            </button>
          </div>
        )}
      </div>
    </>
  );

  const mainContent = (
    <main className="flex-1 overflow-auto p-4 lg:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-6" style={{ backgroundColor: 'var(--bg-app)' }}>
      <Breadcrumb />
      <Outlet />
    </main>
  );

  if (isHorizontal) {
    return (
      <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
        <header className="h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 flex items-center px-4 lg:px-6 pt-[env(safe-area-inset-top)] z-[100]">
          {headerContent}
        </header>
        {mainContent}
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
        {/* Collapsed sidebar — icons only, always visible */}
        <aside
          className="fixed inset-y-0 left-0 z-40 w-[70px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col"
          onMouseEnter={handleSidebarEnter}
          onMouseLeave={handleSidebarLeave}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-blue-600/5 pointer-events-none" />
          <div className="relative flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b border-white/10">
              <img src="/logo-codemed-horizontal.png" alt="Codemed" className="h-6 w-auto" />
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              {groups.map((group) => {
                const groupActive = isGroupActive(group.items);
                const visibleItems = group.items.filter((item) => userHasRole(user?.role, item.roles));
                if (visibleItems.length === 0) return null;
                const first = visibleItems[0];
                return (
                  <Link key={group.key} to={first.path}
                    title={group.label}
                    className={`flex items-center justify-center w-11 h-11 mx-auto rounded-xl text-sm font-medium transition-all duration-200 ${
                      groupActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                    style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <group.icon size={18} className={groupActive ? 'text-blue-200' : ''} />
                  </Link>
                );
              })}
              {(user?.role === 'admin' || user?.role === 'gerente') && (
                <div className="pt-2 mt-2 border-t border-white/10">
                  <Link to="/app/settings" title="Configurações"
                    className={`flex items-center justify-center w-11 h-11 mx-auto rounded-xl text-sm font-medium transition-all duration-200 ${
                      location.pathname === '/app/settings'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                    style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <Settings size={18} />
                  </Link>
                </div>
              )}
            </nav>
            <div className="p-3 border-t border-white/10">
              <div className="flex items-center justify-center text-white/30 text-xs">
                <LayoutDashboard size={12} />
              </div>
            </div>
          </div>
        </aside>

        {/* Hover overlay — expands to full sidebar */}
        <div
          className={`fixed inset-y-0 left-[70px] z-50 w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl transform transition-all duration-200 ease-out ${
            sidebarHovered ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0 pointer-events-none'
          }`}
          onMouseEnter={handleSidebarEnter}
          onMouseLeave={handleSidebarLeave}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-blue-600/5 pointer-events-none" />
          <div className="relative">
            <SidebarContent collapsed={false} />
          </div>
        </div>

        {sidebarHovered && (
          <div
            className="fixed inset-0 bg-black/20 z-30 transition-opacity"
            onClick={handleSidebarLeave}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 ml-[70px]">
          <header className="h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between px-4 lg:px-6 pt-[env(safe-area-inset-top)] z-[100]">
            {headerContent}
          </header>
          {mainContent}
        </div>
      </div>
    );
  }

  /* Vertical sidebar (default) */
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 transform transition-all duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-blue-600/5 pointer-events-none" />
        <div className="relative">
          <SidebarContent collapsed={false} />
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between px-4 lg:px-6 pt-[env(safe-area-inset-top)] z-[100]">
          {headerContent}
        </header>
        {mainContent}
      </div>
    </div>
  );
}
