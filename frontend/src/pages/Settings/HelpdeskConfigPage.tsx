import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Save, Clock, MessageSquare, RefreshCw, Info } from 'lucide-react';

const DIAS_SEMANA = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const VARS_DISPONIVEIS = [
  { var: '{{nome}}', desc: 'Nome do contato' },
  { var: '{{saudacao}}', desc: 'Bom dia/Boa tarde/Boa noite' },
];

export default function HelpdeskConfigPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    mensagemBoasVindas: '',
    mensagemAckSuporte: '',
    mensagemAckComercial: '',
    mensagemOpcaoInvalida: '',
    mensagemForaHorario: '',
    mensagemFollowup: '',
    horarioInicio: '08:00',
    horarioFim: '18:00',
    horarioSabadoInicio: '07:00',
    horarioSabadoFim: '12:00',
    diasAtendimento: '1,2,3,4,5',
    tempoInatividadeMin: 5,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await api.get('/helpdesk/etapas');
      const fila = data.find((s: any) => s.slug === 'fila');
      if (fila) {
        setConfig({
          mensagemBoasVindas: fila.mensagemBoasVindas || '',
          mensagemAckSuporte: fila.mensagemAckSuporte || '',
          mensagemAckComercial: fila.mensagemAckComercial || '',
          mensagemOpcaoInvalida: fila.mensagemOpcaoInvalida || '',
          mensagemForaHorario: fila.mensagemForaHorario || '',
          mensagemFollowup: fila.mensagemFollowup || '',
          horarioInicio: fila.horarioInicio || '08:00',
          horarioFim: fila.horarioFim || '18:00',
          horarioSabadoInicio: fila.horarioSabadoInicio || '07:00',
          horarioSabadoFim: fila.horarioSabadoFim || '12:00',
          diasAtendimento: fila.diasAtendimento || '1,2,3,4,5',
          tempoInatividadeMin: fila.tempoInatividadeMin ?? 5,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: stages } = await api.get('/helpdesk/etapas');
      const fila = stages.find((s: any) => s.slug === 'fila');
      if (!fila) return;

      await api.patch(`/helpdesk/etapas/${fila.id}`, {
        mensagemBoasVindas: config.mensagemBoasVindas || null,
        mensagemAckSuporte: config.mensagemAckSuporte || null,
        mensagemAckComercial: config.mensagemAckComercial || null,
        mensagemOpcaoInvalida: config.mensagemOpcaoInvalida || null,
        mensagemForaHorario: config.mensagemForaHorario || null,
        mensagemFollowup: config.mensagemFollowup || null,
        horarioInicio: config.horarioInicio || null,
        horarioFim: config.horarioFim || null,
        horarioSabadoInicio: config.horarioSabadoInicio || null,
        horarioSabadoFim: config.horarioSabadoFim || null,
        diasAtendimento: config.diasAtendimento || null,
        tempoInatividadeMin: config.tempoInatividadeMin || null,
      });
      alert('Configurações salvas com sucesso!');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleDia = (dia: number) => {
    const dias = config.diasAtendimento.split(',').filter(Boolean).map(Number);
    const idx = dias.indexOf(dia);
    if (idx >= 0) {
      dias.splice(idx, 1);
    } else {
      dias.push(dia);
    }
    setConfig({ ...config, diasAtendimento: dias.sort().join(',') });
  };

  const diasAtivos = config.diasAtendimento.split(',').filter(Boolean).map(Number);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-blue-600 dark:text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/settings')} className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Configurações do Helpdesk
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Mensagens automáticas, horário de funcionamento e menu
          </p>
        </div>
      </div>

      {/* Variáveis disponíveis */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-800" style={{ fontFamily: 'Lexend, sans-serif' }}>Variáveis disponíveis nas mensagens</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {VARS_DISPONIVEIS.map((v) => (
            <code key={v.var} className="text-xs bg-white dark:bg-slate-800 border border-blue-200 text-blue-700 px-2 py-1 rounded-lg">
              {v.var} <span className="text-blue-400">— {v.desc}</span>
            </code>
          ))}
        </div>
      </div>

      {/* Horário de Funcionamento */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
          <Clock size={20} className="text-blue-600 dark:text-blue-400" />
          Horário de Funcionamento
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>Horário de início (Seg-Sex)</label>
            <input
              type="time"
              value={config.horarioInicio}
              onChange={(e) => setConfig({ ...config, horarioInicio: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>Horário de fim (Seg-Sex)</label>
            <input
              type="time"
              value={config.horarioFim}
              onChange={(e) => setConfig({ ...config, horarioFim: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>Horário de início (Sábado)</label>
            <input
              type="time"
              value={config.horarioSabadoInicio}
              onChange={(e) => setConfig({ ...config, horarioSabadoInicio: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>Horário de fim (Sábado)</label>
            <input
              type="time"
              value={config.horarioSabadoFim}
              onChange={(e) => setConfig({ ...config, horarioSabadoFim: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>Dias de atendimento</label>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((d) => (
              <button
                key={d.value}
                onClick={() => toggleDia(d.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  diasAtivos.includes(d.value)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Tempo de inatividade para follow-up (minutos)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={config.tempoInatividadeMin}
            onChange={(e) => setConfig({ ...config, tempoInatividadeMin: parseInt(e.target.value) || 5 })}
            className="input w-32"
          />
        </div>
      </div>

      {/* Mensagens Automáticas */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
          <MessageSquare size={20} className="text-blue-600 dark:text-blue-400" />
          Mensagens Automáticas
        </h2>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Mensagem de boas-vindas (menu inicial)
            </label>
            <textarea
              value={config.mensagemBoasVindas}
              onChange={(e) => setConfig({ ...config, mensagemBoasVindas: e.target.value })}
              rows={4}
              placeholder="Olá!! {{nome}} {{saudacao}} 👋&#10;&#10;Que bom ter você por aqui!&#10;&#10;Como podemos te ajudar hoje(Apenas números)?&#10;1️⃣ Suporte&#10;2️⃣ Comercial"
              className="input resize-none"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Enviada quando um cliente entra em contato pela primeira vez
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Resposta — Opção 1 (Suporte)
              </label>
              <textarea
                value={config.mensagemAckSuporte}
                onChange={(e) => setConfig({ ...config, mensagemAckSuporte: e.target.value })}
                rows={3}
                placeholder="Perfeito, {{nome}}! 🛠️&#10;Você escolheu Suporte.&#10;Descreva seu problema..."
                className="input resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Resposta — Opção 2 (Comercial)
              </label>
              <textarea
                value={config.mensagemAckComercial}
                onChange={(e) => setConfig({ ...config, mensagemAckComercial: e.target.value })}
                rows={3}
                placeholder="Ótimo, {{nome}}! 💼&#10;Você escolheu Comercial.&#10;Um consultor entrará em contato..."
                className="input resize-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Resposta — Opção inválida
            </label>
            <textarea
              value={config.mensagemOpcaoInvalida}
              onChange={(e) => setConfig({ ...config, mensagemOpcaoInvalida: e.target.value })}
              rows={2}
              placeholder="Hmm, não entendi... responda 1 para Suporte ou 2 para Comercial."
              className="input resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Mensagem fora do horário
            </label>
            <textarea
              value={config.mensagemForaHorario}
              onChange={(e) => setConfig({ ...config, mensagemForaHorario: e.target.value })}
              rows={2}
              placeholder="Nosso horário é de segunda a sexta, das 08:00 às 18:00..."
              className="input resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Mensagem de follow-up (após inatividade)
            </label>
            <textarea
              value={config.mensagemFollowup}
              onChange={(e) => setConfig({ ...config, mensagemFollowup: e.target.value })}
              rows={2}
              placeholder="Olá {{nome}}, ainda estamos aguardando sua resposta..."
              className="input resize-none"
            />
          </div>
        </div>
      </div>

      {/* Botão salvar */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
