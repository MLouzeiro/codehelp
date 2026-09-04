import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertCircle, Loader, FileText, User, Package, Shield } from 'lucide-react';
import SignatureCanvas, { type SignatureCanvasHandle } from '../../components/SignatureCanvas';

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validarCpf(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned.charAt(i)) * (10 - i);
  let remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned.charAt(i)) * (11 - i);
  remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleaned.charAt(10));
}

function mascararCpf(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `***.***.***-${cleaned.slice(-2)}`;
}

export default function SignPage() {
  const { token } = useParams();
  const signatureRef = useRef<HTMLDivElement>(null);
  const canvasHandleRef = useRef<SignatureCanvasHandle>(null);
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
  const [consent, setConsent] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showWithoutSignature, setShowWithoutSignature] = useState(false);
  const [signatureIdentifier, setSignatureIdentifier] = useState('');

  useEffect(() => {
    loadSignature();
  }, [token]);

  const loadSignature = async () => {
    try {
      const { data: res } = await axios.get(`/api/orders/sign/${token}`);
      setData(res);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || '';
      if (msg.includes('expirado')) {
        setError('Este link de assinatura expirou. Solicite um novo link ao responsável pela OS.');
      } else if (msg.includes('cancelada')) {
        setError('Esta solicitação de assinatura foi cancelada.');
      } else if (msg.includes('recusada')) {
        setError('Esta assinatura foi recusada anteriormente.');
      } else if (msg.includes('inválido') || msg.includes('TOKEN_INVALIDO')) {
        setError('Link de assinatura inválido. Verifique o link recebido.');
      } else if (msg.includes('já assinada') || msg.includes('JA_ASSINADA')) {
        setError('Esta OS já foi assinada anteriormente.');
      } else if (!navigator.onLine) {
        setError('Você está sem conexão. Verifique sua internet e tente novamente.');
      } else {
        setError('Não foi possível carregar os dados da assinatura. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getSignatureBase64 = (): string | null => {
    // Prefer ref-based approach (more reliable)
    if (canvasHandleRef.current) {
      return canvasHandleRef.current.getSignatureBase64();
    }
    // Fallback to DOM query
    const input = signatureRef.current?.querySelector('input[data-signature-base64]') as HTMLInputElement | null;
    return input?.value || null;
  };

  const handleCpfChange = (value: string) => {
    setForm({ ...form, assinanteCpf: formatCpf(value) });
  };

  const validateForm = (): string | null => {
    if (!form.assinanteNome.trim()) return 'Informe o nome completo';
    if (form.assinanteNome.trim().split(' ').length < 2) return 'Informe o nome completo (nome e sobrenome)';
    if (!form.assinanteCpf.trim()) return 'Informe o CPF';
    if (!validarCpf(form.assinanteCpf)) return 'CPF inválido';
    if (!form.assinanteCargo.trim()) return 'Informe a função/cargo';
    if (!hasSignature) return 'Desenhe sua assinatura antes de continuar';
    if (!consent) return 'É necessário aceitar a declaração para assinar';
    return null;
  };

  const handleConfirmClick = () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setShowConfirmation(true);
  };

  const submitSignature = async () => {
    const assinaturaBase64 = getSignatureBase64();
    if (!assinaturaBase64) {
      setError('Desenhe sua assinatura no campo indicado');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data: result } = await axios.post(`/api/orders/sign/${token}`, {
        ...form,
        assinanteCpf: form.assinanteCpf.replace(/\D/g, ''),
        assinaturaBase64,
        timezone,
      });
      setSignatureIdentifier(result.signatureIdentifier || '');
      setSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || '';
      if (msg.includes('expirado')) {
        setError('Sua sessão de assinatura expirou. Solicite um novo link.');
      } else if (msg.includes('já assinada') || msg.includes('JA_ASSINADA')) {
        setError('Esta OS já foi assinada anteriormente.');
      } else if (msg.includes('cancelada')) {
        setError('Esta solicitação de assinatura foi cancelada.');
      } else if (msg.includes('recusada')) {
        setError('Esta assinatura foi recusada anteriormente.');
      } else if (msg.includes('inválido') || msg.includes('TOKEN_INVALIDO')) {
        setError('Link de assinatura inválido. Solicite um novo link.');
      } else if (!navigator.onLine) {
        setError('Você está sem conexão. Verifique sua internet e tente novamente.');
      } else {
        setError('Não foi possível salvar sua assinatura. Verifique sua conexão e tente novamente.');
      }
      setShowConfirmation(false);
    } finally {
      setSubmitting(false);
    }
  };

  const submitWithoutSignature = async () => {
    if (!form.assinanteNome.trim() || !form.assinanteCpf.trim() || !form.assinanteCargo.trim()) {
      setError('Preencha nome, CPF e cargo');
      return;
    }
    if (!validarCpf(form.assinanteCpf)) {
      setError('CPF inválido');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data: result } = await axios.post(`/api/orders/sign/${token}/without-signature`, {
        assinanteNome: form.assinanteNome,
        assinanteCpf: form.assinanteCpf.replace(/\D/g, ''),
        assinanteCargo: form.assinanteCargo,
        timezone,
      });
      setSignatureIdentifier(result.signatureIdentifier || '');
      setShowWithoutSignature(false);
      setSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || '';
      if (msg.includes('expirado')) {
        setError('Sua sessão expirou. Solicite um novo link.');
      } else if (msg.includes('já assinada') || msg.includes('JA_ASSINADA')) {
        setError('Esta OS já foi assinada anteriormente.');
      } else if (msg.includes('cancelada')) {
        setError('Esta solicitação de assinatura foi cancelada.');
      } else if (msg.includes('recusada')) {
        setError('Esta assinatura foi recusada anteriormente.');
      } else if (msg.includes('inválido') || msg.includes('TOKEN_INVALIDO')) {
        setError('Link de assinatura inválido. Solicite um novo link.');
      } else if (!navigator.onLine) {
        setError('Você está sem conexão. Verifique sua internet e tente novamente.');
      } else {
        setError('Não foi possível processar. Verifique sua conexão e tente novamente.');
      }
      setShowWithoutSignature(false);
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
      const msg = err.response?.data?.error || err.message || '';
      if (!navigator.onLine) {
        setError('Você está sem conexão. Verifique sua internet e tente novamente.');
      } else {
        setError('Não foi possível processar a recusa. Tente novamente.');
      }
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            {signatureIdentifier ? 'OS Concluída!' : 'OS Assinada!'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            A OS <strong>{data?.order?.numeroOs}</strong> foi {signatureIdentifier ? 'concluída sem assinatura digital' : 'assinada eletronicamente'}.
          </p>
          {signatureIdentifier && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 font-mono" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Identificador: {signatureIdentifier}
            </p>
          )}
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
            Codemed — Assinatura Eletrônica
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

          {data?.items && data.items.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Package size={14} className="text-blue-600" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Itens / Serviços
                </p>
              </div>
              <div className="space-y-1.5">
                {data.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-750 rounded-lg px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{item.descricao}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          item.tipo === 'material' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          item.tipo === 'outros' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>{item.tipo === 'material' ? 'Material' : item.tipo === 'outros' ? 'Outros' : 'Serviço'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>Qtd: {item.quantidade}</span>
                        {item.valorUnitario && <span>Unit: R$ {item.valorUnitario.toFixed(2)}</span>}
                        {item.valorTotal != null && <span className="font-medium text-green-600">Total: R$ {item.valorTotal.toFixed(2)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm font-semibold text-green-600 pt-1">
                  Total dos Itens: R$ {data.items.reduce((sum: number, item: any) => sum + (item.valorTotal || 0), 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Signer Info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Dados do Responsável pela Assinatura
            </h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>Nome completo *</label>
              <input
                type="text"
                placeholder="Nome e sobrenome"
                value={form.assinanteNome}
                onChange={(e) => setForm({ ...form, assinanteNome: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>CPF *</label>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={form.assinanteCpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                maxLength={14}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>Função / Cargo *</label>
              <input
                type="text"
                placeholder="Ex: Responsável Técnico, Gerente, Diretor"
                value={form.assinanteCargo}
                onChange={(e) => setForm({ ...form, assinanteCargo: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              />
            </div>
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5" ref={signatureRef}>
          <SignatureCanvas
            ref={canvasHandleRef}
            height={200}
            strokeColor="#1e3a8a"
            strokeWidth={2.5}
            onSignatureChange={setHasSignature}
          />
        </div>

        {/* Continuar sem assinatura */}
        {!hasSignature && (
          <button
            type="button"
            onClick={() => { setError(''); setShowWithoutSignature(true); }}
            disabled={submitting}
            className="w-full py-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-2xl transition-colors text-sm font-medium min-h-[48px]"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            Continuar sem assinatura
          </button>
        )}

        {/* Consent */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Declaro que os dados informados são verdadeiros e que estou realizando a assinatura eletrônica desta Ordem de Serviço.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Li e concordo com a declaração acima
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
            <AlertCircle size={18} />
            <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</span>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                Confirmar Assinatura
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Nome:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{form.assinanteNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">CPF:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{mascararCpf(form.assinanteCpf)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Função:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{form.assinanteCargo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Data/Hora:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">Será registrada automaticamente</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Confirmo os dados e desejo assinar esta Ordem de Serviço.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors text-sm min-h-[48px]"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={submitSignature}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm min-h-[48px]"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={16} className="animate-spin" />
                      Assinando...
                    </span>
                  ) : (
                    'Assinar OS'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Without Signature Confirmation Modal */}
        {showWithoutSignature && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                Concluir sem assinatura?
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Nome:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{form.assinanteNome || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">CPF:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{form.assinanteCpf ? mascararCpf(form.assinanteCpf) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Função:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{form.assinanteCargo || '—'}</span>
                </div>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl" style={{ fontFamily: 'Lexend, sans-serif' }}>
                A OS será marcada como concluída sem assinatura digital. Seus dados (nome, CPF, cargo) serão registrados para fins de auditoria.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWithoutSignature(false)}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors text-sm min-h-[48px]"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  Voltar
                </button>
                <button
                  onClick={submitWithoutSignature}
                  disabled={submitting}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm min-h-[48px]"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader size={16} className="animate-spin" />
                      Processando...
                    </span>
                  ) : (
                    'Confirmar sem assinatura'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleConfirmClick}
          disabled={submitting || !hasSignature || !consent}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-colors shadow-lg text-base min-h-[56px]"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          Confirmar Assinatura
        </button>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 pb-4" style={{ fontFamily: 'Lexend, sans-serif' }}>
          Assinatura eletrônica da Ordem de Serviço — Esta assinatura é vinculada ao documento e tem validade conforme legislação vigente.
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
