import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertCircle, Loader, FileText, User, Building2 } from 'lucide-react';
import SignatureCanvas from '../../components/SignatureCanvas';

export default function SignPage() {
  const { token } = useParams();
  const signatureRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [form, setForm] = useState({ assinanteNome: '', assinanteCpf: '', assinanteCargo: '' });
  const [refusing, setRefusing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    loadSignature();
  }, [token]);

  const loadSignature = async () => {
    try {
      const { data: res } = await axios.get(`/api/orders/sign/${token}`);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados da assinatura');
    } finally {
      setLoading(false);
    }
  };

  const getSignatureBase64 = (): string | null => {
    const input = signatureRef.current?.querySelector('input[data-signature-base64]') as HTMLInputElement | null;
    return input?.value || null;
  };

  const submitSignature = async () => {
    if (!form.assinanteNome || !form.assinanteCpf || !form.assinanteCargo) {
      setError('Preencha todos os campos do assinante');
      return;
    }

    const assinaturaBase64 = getSignatureBase64();
    if (!assinaturaBase64) {
      setError('Desenhe sua assinatura no campo indicado');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await axios.post(`/api/orders/sign/${token}`, {
        ...form,
        assinaturaBase64,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao processar assinatura');
    } finally {
      setSubmitting(false);
    }
  };

  const refuseSignature = async () => {
    if (!rejectionReason.trim()) {
      setError('Informe o motivo da recusa');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await axios.post(`/api/orders/sign/${token}/recusar`, { motivo: rejectionReason });
      setRefused(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao processar recusa');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 dark:from-slate-900 dark:to-slate-800 safe-area">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-blue-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 dark:from-slate-900 dark:to-slate-800 p-4 safe-area">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2" style={{ fontFamily: 'Khand, sans-serif' }}>Link Inválido</h2>
          <p className="text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (refused) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 dark:from-slate-900 dark:to-slate-800 p-4 safe-area">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2" style={{ fontFamily: 'Khand, sans-serif' }}>Assinatura Recusada</h2>
          <p className="text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            A OS <strong>{data?.order?.numeroOs}</strong> teve a assinatura recusada. Nossa equipe foi notificada.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 dark:from-slate-900 dark:to-slate-800 p-4 safe-area">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 max-w-md text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2" style={{ fontFamily: 'Khand, sans-serif' }}>OS Assinada!</h2>
          <p className="text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            A OS <strong>{data?.order?.numeroOs}</strong> foi assinada eletronicamente.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-4" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Você receberá uma cópia por e-mail.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-slate-900 dark:to-slate-800 py-6 px-4 safe-area">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'Khand, sans-serif' }}>C</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Assinatura de OS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Codemed — Assinatura Digital
          </p>
        </div>

        {/* OS Summary */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Resumo da OS
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Número</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{data?.order?.numeroOs}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Tipo</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{data?.order?.tipoServico}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Cliente</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{data?.client?.razaoSocial}</p>
            </div>
            {data?.order?.valorServico && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Valor</p>
                <p className="font-semibold text-green-600">R$ {data.order.valorServico}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Técnico</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{data?.tecnico}</p>
            </div>
          </div>
          {data?.order?.descricaoServico && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>Descrição</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-750 p-3 rounded-xl" style={{ fontFamily: 'Lexend, sans-serif' }}>
                {data.order.descricaoServico}
              </p>
            </div>
          )}
        </div>

        {/* Signer Info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Dados do Assinante
            </h2>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Nome completo"
              value={form.assinanteNome}
              onChange={(e) => setForm({ ...form, assinanteNome: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            />
            <input
              type="text"
              placeholder="CPF"
              value={form.assinanteCpf}
              onChange={(e) => setForm({ ...form, assinanteCpf: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            />
            <input
              type="text"
              placeholder="Cargo / Função"
              value={form.assinanteCargo}
              onChange={(e) => setForm({ ...form, assinanteCargo: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            />
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5" ref={signatureRef}>
          <SignatureCanvas
            height={200}
            strokeColor="#1e3a8a"
            strokeWidth={2.5}
            onSignatureChange={setHasSignature}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
            <AlertCircle size={18} />
            <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={submitSignature}
          disabled={submitting || !hasSignature}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-colors shadow-lg text-base min-h-[56px]"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader size={18} className="animate-spin" />
              Processando...
            </span>
          ) : (
            'Assinar OS'
          )}
        </button>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 pb-4" style={{ fontFamily: 'Lexend, sans-serif' }}>
          Ao assinar, você concorda com os termos do serviço. Esta assinatura tem validade jurídica.
        </p>

        {!refusing ? (
          <button
            onClick={() => { setError(''); setRefusing(true); }}
            disabled={submitting}
            className="w-full py-3 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl transition-colors text-sm font-medium min-h-[48px]"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            Não desejo assinar — Recusar
          </button>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-red-200 dark:border-red-800 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Informe o motivo da recusa
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: valor divergente, serviço não executado..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[48px]"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            />
            <div className="flex gap-2">
              <button
                onClick={refuseSignature}
                disabled={submitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm min-h-[44px]"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              >
                {submitting ? 'Processando...' : 'Confirmar Recusa'}
              </button>
              <button
                onClick={() => { setRefusing(false); setRejectionReason(''); setError(''); }}
                disabled={submitting}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors text-sm min-h-[44px]"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
