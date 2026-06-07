import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { useTheme } from '../services/useTheme';
import {
  LayoutDashboard, Users, FileText, MessageSquare, Kanban,
  Settings, LogOut, Menu, X, ChevronDown, Bot, TrendingUp, BarChart3,
  Stethoscope, Activity, LineChart, BookOpen, Zap, ArrowUpDown,
  Bell, Check, CheckCheck, Sun, Moon,
} from 'lucide-react';
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
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-codemed-700 border-r border-codemed-100/20 transform transition-transform lg:translate-x-0 lg:static lg:inset-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <Link to="/app/dashboard" className="flex items-center gap-2">
            <img
              src="/logo-codemed-horizontal.png"
              alt="Codemed"
              className="h-8 w-auto"
            />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <nav className="p-3 space-y-0.5">
          {navItems.map((item) => {
            if (item.roles && user && !item.roles.includes(user.role)) return null;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-green-300/15 text-green-300 shadow-sm border border-green-300/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setSidebarOpen(false)}
                style={{ fontFamily: 'Khand, sans-serif', fontSize: '0.9rem', letterSpacing: '0.03em' }}>
                <item.icon size={18} className={active ? 'text-green-300' : ''} />
                {item.label}
              </Link>
            );
          })}
          <div className="pt-3 mt-3 border-t border-white/10">
            {(user?.role === 'admin' || user?.role === 'gerente') && (
              <Link to="/app/settings"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/app/settings'
                    ? 'bg-green-300/15 text-green-300 shadow-sm border border-green-300/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setSidebarOpen(false)}
                style={{ fontFamily: 'Khand, sans-serif', fontSize: '0.9rem', letterSpacing: '0.03em' }}>
                <Settings size={18} />
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
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 backdrop-blur-md border-b flex items-center justify-between px-4 lg:px-6" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'rgba(255,255,255,0.1)' }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/60 hover:text-white">
            <Menu size={24} />
          </button>
          <div className="flex-1" />
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors mr-2"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
              <Bell size={18} className="text-white/70" />
              {naoLidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {naoLidas > 9 ? '9+' : naoLidas}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-codemed-700 rounded-xl shadow-xl border border-white/10 z-50 backdrop-blur-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Notificacoes</span>
                  {naoLidas > 0 && (
                    <button onClick={marcarTodas} className="text-[11px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1">
                      <CheckCheck size={11} /> Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-white/40 text-xs">
                      Nenhuma notificacao
                    </div>
                  ) : (
                    notifs.map((n) => (
                      <div key={n.id}
                        onClick={() => !n.lida && marcarLida(n.id)}
                        className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors ${n.lida ? 'opacity-60' : 'bg-white/5 hover:bg-white/10'}`}>
                        <div className="flex items-start gap-2">
                          {!n.lida && <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/90">{n.mensagem}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-white/40">
                              <span className="px-1.5 py-0.5 bg-white/10 rounded uppercase tracking-wider">{n.tipo}</span>
                              <span>{new Date(n.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          {n.lida && <Check size={12} className="text-white/30 mt-1" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <div className="w-8 h-8 bg-green-300 rounded-full flex items-center justify-center text-codemed-700 text-sm font-bold" style={{ fontFamily: 'Khand, sans-serif' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-white/80 hidden sm:block" style={{ fontFamily: 'Dosis, sans-serif' }}>{user?.name}</span>
              <ChevronDown size={16} className="text-white/40" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-codemed-700 rounded-xl shadow-xl border border-white/10 py-1 z-50 backdrop-blur-lg">
                <div className="px-4 py-2 text-sm text-white/50 border-b border-white/10" style={{ fontFamily: 'Dosis, sans-serif' }}>{user?.email}</div>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors" style={{ fontFamily: 'Khand, sans-serif', letterSpacing: '0.02em' }}>
                  <LogOut size={16} /> Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6" style={{ backgroundColor: 'var(--bg-app)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}