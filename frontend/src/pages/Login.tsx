import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { LogIn, ArrowRight, Shield, Zap, BarChart3, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/app/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex relative overflow-hidden bg-slate-900">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-200px] right-[-200px] w-[700px] h-[700px] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-150px] left-[-150px] w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute top-1/4 left-1/3 w-2 h-2 rounded-full bg-blue-400/30 animate-pulse" />
        <div className="absolute top-2/3 right-1/4 w-1.5 h-1.5 rounded-full bg-blue-300/20" />
        <div className="absolute bottom-1/3 left-1/5 w-1 h-1 rounded-full bg-blue-500/25" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="relative z-10 flex w-full">
        {/* Left side - Brand */}
        <div className="hidden lg:flex lg:w-[55%] flex-col justify-center px-16 xl:px-20">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-14">
              <img src="/logo-codemed-horizontal.png" alt="Codemed" className="h-10 w-auto" />
            </div>

            <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.08] mb-6 tracking-tight"
                style={{ fontFamily: 'Khand, sans-serif' }}>
              O sistema que cresce<br />
              <span className="bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">com seu laboratório</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed max-w-md"
               style={{ fontFamily: 'Lexend, sans-serif' }}>
              CRM, Ordem de Serviço Digital, WhatsApp nativo e Dashboard com IA —
              tudo em um sistema que seu time vai gostar de usar.
            </p>

            <div className="mt-14 space-y-5">
              {[
                  { icon: Shield, text: 'Gestao completa de clientes' },
                { icon: Zap, text: 'OS Digital com assinatura via WhatsApp' },
                { icon: BarChart3, text: 'Dashboard com insights de IA' },
                { icon: ArrowRight, text: 'Kanban de tarefas integrado' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                    <item.icon size={18} className="text-blue-400" />
                  </div>
                  <span className="text-slate-300 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="w-full lg:w-[45%] flex items-center justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="w-full max-w-sm">
            <div className="text-center mb-10 lg:hidden">
              <img src="/logo-codemed-horizontal.png" alt="Codemed" className="h-10 w-auto mx-auto mb-4" />
            </div>

            <div className="bg-white/[0.07] backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-1 tracking-tight"
                  style={{ fontFamily: 'Khand, sans-serif' }}>
                Acessar plataforma
              </h2>
              <p className="text-slate-400 text-sm mb-8"
                 style={{ fontFamily: 'Lexend, sans-serif' }}>
                Faça login para continuar
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3.5 rounded-xl flex items-center gap-2.5"
                       style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2"
                         style={{ fontFamily: 'Lexend, sans-serif' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 min-h-[48px] bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500
                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                    style={{ fontFamily: 'Lexend, sans-serif' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2"
                         style={{ fontFamily: 'Lexend, sans-serif' }}>
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3.5 min-h-[48px] bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 pr-12"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      style={{ fontFamily: 'Lexend, sans-serif' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl
                           hover:from-blue-700 hover:to-blue-600 hover:shadow-brand
                           active:from-blue-800 active:to-blue-700 transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
                  style={{ fontFamily: 'Khand, sans-serif', fontSize: '1.05rem', letterSpacing: '0.03em' }}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Entrando...
                    </div>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Entrar
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="text-center mt-8">
              <Link to="/" className="text-slate-500 hover:text-blue-400 text-sm transition-colors"
                     style={{ fontFamily: 'Lexend, sans-serif' }}>
                ← Voltar para o site
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
