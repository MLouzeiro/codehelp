import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Save, Link2, Globe, Wifi, Server, TestTube, CheckCircle, AlertTriangle, Info } from 'lucide-react';

const TIPO_OPTIONS = [
  { value: 'dominio', label: 'Dominio personalizado', icon: Globe, desc: 'Recomendado para producao. Ex: https://os.empresa.com.br' },
  { value: 'ip_local', label: 'IP da rede local', icon: Wifi, desc: 'Acessivel apenas na mesma rede. Ex: http://192.168.1.50:3000' },
  { value: 'ip_publico', label: 'IP publico', icon: Server, desc: 'Acessivel externamente, se configurado. Ex: http://200.100.50.25:3000' },
  { value: 'automatico', label: 'Automatico', icon: AlertTriangle, desc: 'Usa a variavel de ambiente APP_URL. Nao recomendado para producao.' },
] as const;

export default function OsSignatureConfigPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [tipo, setTipo] = useState<string>('dominio');
  const [baseUrl, setBaseUrl] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; mensagem: string; urlTestada: string } | null>(null);

  const [configurado, setConfigurado] = useState(false);
  const [fonte, setFonte] = useState('');
  const [ultimaAlteracao, setUltimaAlteracao] = useState('');
  const [alteradoPor, setAlteradoPor] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await api.get('/orders/signature-config');
      setConfigurado(data.configurado);
      setFonte(data.fonte);
      if (data.config) {
        setTipo(data.config.tipo || 'dominio');
        setBaseUrl(data.config.baseUrl || '');
      } else if (data.baseUrl) {
        setBaseUrl(data.baseUrl);
        if (data.fonte === 'localhost') setTipo('automatico');
        else if (data.fonte === 'variavel_ambiente') setTipo('automatico');
      }
      if (data.registro) {
        setUltimaAlteracao(data.registro.updatedAt ? new Date(data.registro.updatedAt).toLocaleString('pt-BR') : '');
      }
    } catch (err) {
      setError('Erro ao carregar configuracao.');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const { data } = await api.post('/orders/signature-config/test', { url: baseUrl });
      setTestResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao testar endereco.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/orders/signature-config', { baseUrl, tipo });
      setSuccess('Configuracao salva com sucesso!');
      setConfigurado(true);
      setUltimaAlteracao(new Date().toLocaleString('pt-BR'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar configuracao.');
    } finally {
      setSaving(false);
    }
  };

  const exampleToken = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  const exampleUrl = baseUrl ? `${baseUrl}/assinar/${exampleToken}` : `http://localhost:3000/assinar/${exampleToken}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-codemed-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/settings')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
          <ArrowLeft size={20} className="text-gray-600 dark:text-slate-300" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Endereco Publico das Ordens de Servico</h1>
          <p className="text-gray-500 dark:text-slate-400">Configure o endereco utilizado nos links de assinatura enviados aos clientes</p>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
          <span className="text-green-700 dark:text-green-300 text-sm">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Status da Configuracao</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${configurado ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'}`}>
            {configurado ? 'Configurado' : 'Nao configurado'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-slate-400">Endereco atual:</span>
            <p className="font-mono text-gray-900 dark:text-slate-100 mt-1">{baseUrl || 'Nenhum'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-slate-400">Fonte:</span>
            <p className="text-gray-900 dark:text-slate-100 mt-1 capitalize">{fonte === 'banco' ? 'Configuracao manual' : fonte === 'variavel_ambiente' ? 'Variavel de ambiente' : 'Localhost (desenvolvimento)'}</p>
          </div>
          {ultimaAlteracao && (
            <div>
              <span className="text-gray-500 dark:text-slate-400">Ultima alteracao:</span>
              <p className="text-gray-900 dark:text-slate-100 mt-1">{ultimaAlteracao}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Tipo de Endereco</h2>
        <div className="space-y-3">
          {TIPO_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                tipo === opt.value
                  ? 'border-codemed-500 bg-codemed-50 dark:bg-codemed-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={opt.value}
                checked={tipo === opt.value}
                onChange={(e) => setTipo(e.target.value)}
                className="mt-1 accent-codemed-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <opt.icon size={16} className="text-gray-600 dark:text-slate-300" />
                  <span className="font-medium text-gray-900 dark:text-slate-100">{opt.label}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Endereco Publico</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              URL base para os links de assinatura
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null); }}
              placeholder="https://os.empresa.com.br"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-codemed-500 focus:border-codemed-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Aceita http:// ou https://. Inclua a porta se necessario (ex: :3000).
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing || !baseUrl}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TestTube size={16} />
              {testing ? 'Testando...' : 'Testar endereco'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !baseUrl}
              className="flex items-center gap-2 px-4 py-2 bg-codemed-600 text-white rounded-lg hover:bg-codemed-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar configuracao'}
            </button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg border ${testResult.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                {testResult.ok ? (
                  <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
                )}
                <span className={`font-medium text-sm ${testResult.ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {testResult.ok ? 'Formato valido' : 'Formato invalido'}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-300">{testResult.mensagem}</p>
              {testResult.urlTestada && (
                <p className="text-xs font-mono text-gray-500 dark:text-slate-400 mt-2">Exemplo: {testResult.urlTestada}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">Exemplo de Link Gerado</h2>
        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 font-mono text-sm text-gray-700 dark:text-slate-300 break-all">
          {exampleUrl}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-600 dark:text-slate-400 space-y-2">
            <p><strong className="text-gray-900 dark:text-slate-100">IP local:</strong> Usado para computadores dentro da mesma rede. Ex: 192.168.1.50</p>
            <p><strong className="text-gray-900 dark:text-slate-100">IP publico:</strong> Acesso externo, desde que a rede esteja configurada (firewall, NAT, port forwarding).</p>
            <p><strong className="text-gray-900 dark:text-slate-100">Dominio:</strong> Opcao recomendada para producao. Ex: https://os.empresa.com.br</p>
            <p><strong className="text-gray-900 dark:text-slate-100">Automatico:</strong> Usa a variavel de ambiente APP_URL. Para Vercel, configure APP_URL no painel.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
