import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex relative overflow-hidden bg-codemed-700">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full bg-green-300/5 blur-3xl" />
        <div className="absolute bottom-[-150px] left-[-150px] w-[500px] h-[500px] rounded-full bg-green-300/3 blur-3xl" />
        <div className="absolute top-1/3 left-1/6 w-1.5 h-1.5 rounded-full bg-green-300/30" />
        <div className="absolute top-2/3 right-1/4 w-2 h-2 rounded-full bg-green-300/20" />
        <div className="absolute bottom-1/4 left-1/3 w-1 h-1 rounded-full bg-green-300/25" />
      </div>

      <div className="relative z-10 flex w-full">
        {/* Left side - Brand */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16">
          <div className="max-w-md">
            <img
              src="/logo-codemed-horizontal.png"
              alt="Codemed"
              className="h-12 w-auto mb-12"
            />
            <h1 className="text-5xl font-bold text-white leading-tight mb-6"
                style={{ fontFamily: 'Khand, sans-serif', letterSpacing: '-0.02em' }}>
              O sistema que cresce<br />
              <span className="text-green-300">com seu laboratório</span>
            </h1>
            <p className="text-lg text-white/60 leading-relaxed"
               style={{ fontFamily: 'Dosis, sans-serif' }}>
              CRM, Ordem de Serviço Digital, WhatsApp nativo e Dashboard com IA —
              tudo em um sistema que seu time vai gostar de usar.
            </p>

            <div className="mt-12 space-y-4">
              {[
                'Gestão completa de clientes',
                'OS Digital com assinatura via WhatsApp',
                'Dashboard com insights de IA',
                'Kanban de tarefas integrado',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-white/70">
                  <div className="w-5 h-5 rounded-full bg-green-300/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-300" />
                  </div>
                  <span style={{ fontFamily: 'Dosis, sans-serif' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8 lg:hidden">
              <img
                src="/logo-codemed-horizontal.png"
                alt="Codemed"
                className="h-10 w-auto mx-auto mb-8"
              />
            </div>

            <div className="bg-white dark:bg-[#1A2222]/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-1"
                  style={{ fontFamily: 'Khand, sans-serif', letterSpacing: '-0.01em' }}>
                Acessar plataforma
              </h2>
              <p className="text-white/40 text-sm mb-8"
                 style={{ fontFamily: 'Dosis, sans-serif' }}>
                Faça login para continuar
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2"
                       style={{ fontFamily: 'Dosis, sans-serif' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1.5"
                         style={{ fontFamily: 'Khand, sans-serif', letterSpacing: '0.03em' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-[#1A2222]/5 border border-white/10 rounded-lg text-white placeholder:text-white/30
                             focus:ring-2 focus:ring-green-300 focus:border-green-300 outline-none transition-all duration-200"
                    placeholder="seu@email.com"
                    required
                    style={{ fontFamily: 'Dosis, sans-serif' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1.5"
                         style={{ fontFamily: 'Khand, sans-serif', letterSpacing: '0.03em' }}>
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-[#1A2222]/5 border border-white/10 rounded-lg text-white placeholder:text-white/30
                             focus:ring-2 focus:ring-green-300 focus:border-green-300 outline-none transition-all duration-200"
                    placeholder="••••••••"
                    required
                    style={{ fontFamily: 'Dosis, sans-serif' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-green-300 text-codemed-700 dark:text-neutral-100 font-bold rounded-lg
                           hover:bg-green-200 hover:shadow-brand
                           active:bg-green-400 transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                  style={{ fontFamily: 'Khand, sans-serif', fontSize: '1.05rem', letterSpacing: '0.03em' }}
                >
                  {loading ? 'Entrando...' : (
                    <>
                      <LogIn size={18} />
                      Entrar
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="text-center mt-6">
              <Link to="/" className="text-white/40 hover:text-green-300 text-sm transition-colors"
                     style={{ fontFamily: 'Dosis, sans-serif' }}>
                ← Voltar para o site
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}