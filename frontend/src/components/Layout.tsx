import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { useTheme } from '../services/useTheme';
import {
  LayoutDashboard, Users, FileText, MessageSquare, Kanban,
  Settings, LogOut, Menu, X, ChevronDown, Bot, TrendingUp, BarChart3,
  Stethoscope, Activity, LineChart, BookOpen, Zap, ArrowUpDown,
  Bell, Check, CheckCheck, Sun, Moon,
} from 'lucide-react';
import SearchBar from './SearchBar';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import type { Notificacao } from '../types';

const navItems = [
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/helpdesk', label: 'Helpdesk', icon: Stethoscope },
  { path: '/app/helpdesk/painel', label: 'Painel ao Vivo', icon: Activity, roles: ['admin', 'gerente'] },
  { path: '/app/helpdesk/metrics', label: 'Métricas Helpdesk', icon: LineChart, roles: ['admin', 'gerente'] },
  { path: '/app/helpdesk/board', label: 'Board por Status', icon: ArrowUpDown, roles: ['admin', 'gerente'] },
  { path: '/app/kb', label: 'Base de Conhecimento', icon: BookOpen, roles: ['admin', 'gerente', 'tecnico', 'vendedor'] },
  { path: '/app/automations', label: 'Automações', icon: Zap, roles: ['admin', 'gerente', 'supervisor'] },
  { path: '/app/crm', label: 'CRM', icon: Users },
  { path: '/app/crm/pipeline', label: 'Pipeline', icon: TrendingUp },
  { path: '/app/orders', label: 'OS', icon: FileText },
  { path: '/app/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { path: '/app/kanban', label: 'Tarefas', icon: Kanban },
  { path: '/app/robos', label: 'Robos', icon: Bot },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 transform transition-all duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Sidebar gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-blue-600/5 pointer-events-none" />

        <div className="relative flex items-center justify-between h-16 px-5 border-b border-white/10">
          <Link to="/app/dashboard" className="flex items-center gap-2">
            <img src="/logo-codemed-horizontal.png" alt="Codemed" className="h-8 w-auto" />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <nav className="relative p-3 space-y-0.5 overflow-y-auto h-[calc(100%-4rem-3rem)]">
          {navItems.map((item) => {
            if (item.roles && user && !item.roles.includes(user.role)) return null;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setSidebarOpen(false)}
                style={{ fontFamily: 'Lexend, sans-serif', fontSize: '0.82rem', letterSpacing: '0.01em' }}>
                <item.icon size={17} className={active ? 'text-blue-200' : ''} />
                {item.label}
              </Link>
            );
          })}
          <div className="pt-3 mt-3 border-t border-white/10">
            {(user?.role === 'admin' || user?.role === 'gerente') && (
              <Link to="/app/settings"
                className={`flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/app/settings'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setSidebarOpen(false)}
                style={{ fontFamily: 'Lexend, sans-serif', fontSize: '0.82rem', letterSpacing: '0.01em' }}>
                <Settings size={17} />
                Configurações
              </Link>
            )}
          </div>
        </nav>

        {/* Sidebar footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-white/30 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <BarChart3 size={12} />
            Codemed Hub v1.0
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 lg:px-6 pt-[env(safe-area-inset-top)]">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
            <Menu size={22} />
          </button>
          <div className="flex-1 max-w-md mx-4 hidden sm:block">
            <SearchBar compact />
          </div>
          <div className="flex-1" />
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors mr-2 text-slate-500 hover:text-slate-700"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700">
              <Bell size={18} />
              {naoLidas > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-blue-600 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white">
                  {naoLidas > 9 ? '9+' : naoLidas}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-slide-down">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: 'Khand, sans-serif' }}>Notificações</span>
                  {naoLidas > 0 && (
                    <button onClick={marcarTodas} className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                      <CheckCheck size={11} /> Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-xs">
                      Nenhuma notificação
                    </div>
                  ) : (
                    notifs.map((n) => (
                      <div key={n.id}
                        onClick={() => !n.lida && marcarLida(n.id)}
                        className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors ${n.lida ? 'opacity-60' : 'bg-blue-50/50 hover:bg-blue-50'}`}>
                        <div className="flex items-start gap-2">
                          {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700">{n.mensagem}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 uppercase tracking-wider font-medium">{n.tipo}</span>
                              <span>{new Date(n.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          {n.lida && <Check size={12} className="text-slate-300 mt-1" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-xl hover:bg-slate-100 transition-colors">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm" style={{ fontFamily: 'Khand, sans-serif' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700 hidden sm:block" style={{ fontFamily: 'Lexend, sans-serif' }}>{user?.name}</span>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-slide-down">
                <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{user?.email}</div>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <LogOut size={16} /> Sair do sistema
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
