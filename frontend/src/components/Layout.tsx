import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import {
  LayoutDashboard, Users, FileText, MessageSquare, Kanban,
  Settings, LogOut, Menu, X, ChevronDown, Bot, TrendingUp, BarChart3,
  Stethoscope, Activity, LineChart, BookOpen,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/helpdesk', label: 'Helpdesk', icon: Stethoscope },
  { path: '/app/helpdesk/painel', label: 'Painel ao Vivo', icon: Activity, roles: ['admin', 'gerente'] },
  { path: '/app/helpdesk/metrics', label: 'Métricas Helpdesk', icon: LineChart, roles: ['admin', 'gerente'] },
  { path: '/app/kb', label: 'Base de Conhecimento', icon: BookOpen, roles: ['admin', 'gerente', 'tecnico', 'vendedor'] },
  { path: '/app/crm', label: 'CRM', icon: Users },
  { path: '/app/crm/pipeline', label: 'Pipeline', icon: TrendingUp },
  { path: '/app/orders', label: 'OS', icon: FileText },
  { path: '/app/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { path: '/app/kanban', label: 'Tarefas', icon: Kanban },
  { path: '/app/robos', label: 'Robos', icon: Bot },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-neutral-50">
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
        <header className="h-16 bg-codemed-700/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/60 hover:text-white">
            <Menu size={24} />
          </button>
          <div className="flex-1" />
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

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}