import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Check, X, Clock, Loader2, Link2 } from 'lucide-react';

export default function AprovacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ status: string; observacao?: string } | null>(null);

  const decidir = async (decidido: boolean) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/aprovacoes/token/${token}/decidir`, {
        decidido,
      });
      setResultado(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível processar esta aprovação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Link2 size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              Aprovação via Link
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Valide a solicitação sem precisar acessar o sistema
            </p>
          </div>
        </div>

        <div className="p-6">
          {resultado ? (
            <div className="text-center py-6">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                resultado.status === 'aprovada' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' : 'bg-red-100 text-red-600 dark:bg-red-900/40'
              }`}>
                {resultado.status === 'aprovada' ? <Check size={32} /> : <X size={32} />}
              </div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                {resultado.status === 'aprovada' ? 'Aprovação confirmada!' : 'Aprovação rejeitada'}
              </h2>
              {resultado.observacao && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  {resultado.observacao}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <Clock size={16} className="text-amber-500" />
                Esta é uma aprovação de ticket. Confirme se deseja aprovar ou rejeitar a solicitação.
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => decidir(true)}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  Aprovar
                </button>
                <button
                  onClick={() => decidir(false)}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                  Rejeitar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
