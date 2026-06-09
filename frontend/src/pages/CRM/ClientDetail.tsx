import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, Calendar, User, Plus,
  Users, Star, Edit2, Trash2, X, Briefcase, MessageCircle,
  Ticket, TrendingUp, Wrench, FileText, History, ChevronRight,
  AlertTriangle, CheckCircle, Clock, CircleDot,
} from 'lucide-react';

interface Colaborador {
  id: string;
  clientId: string;
  nome: string;
  cargo: string | null;
  setor: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  principal: boolean;
  observacoes: string | null;
  ativo: boolean;
}

const COLAB_FORM_VAZIO = {
  nome: '', cargo: '', setor: '', email: '', telefone: '', whatsapp: '', principal: false, observacoes: '',
};

const TABS = [
  { key: 'visao_geral', label: 'Visao Geral', icon: Building2 },
  { key: 'tickets', label: 'Tickets', icon: Ticket },
  { key: 'oportunidades', label: 'Oportunidades', icon: TrendingUp },
  { key: 'colaboradores', label: 'Colaboradores', icon: Users },
  { key: 'ativos', label: 'Ativos', icon: Wrench },
  { key: 'contatos', label: 'Contatos', icon: MessageCircle },
  { key: 'os', label: 'Ordens de Servico', icon: FileText },
];

const STATUS_CORES: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  em_andamento: 'bg-amber-100 text-amber-700',
  pendente: 'bg-orange-100 text-orange-700',
  escalonado: 'bg-purple-100 text-purple-700',
  resolvido: 'bg-green-100 text-green-700',
  fechado: 'bg-gray-100 text-gray-600',
  cancelado: 'bg-red-100 text-red-600',
  arquivado: 'bg-gray-100 text-gray-500',
};

const PRIORIDADE_CORES: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-600',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visao_geral');

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ tipo: 'ligacao', descricao: '', duracaoMinutos: '' });

  const [showColabForm, setShowColabForm] = useState(false);
  const [colabEdit, setColabEdit] = useState<Colaborador | null>(null);
  const [colabForm, setColabForm] = useState(COLAB_FORM_VAZIO);
  const [colabErro, setColabErro] = useState('');
  const [colabSaving, setColabSaving] = useState(false);

  useEffect(() => { loadClient(); }, [id]);

  const loadClient = async () => {
    try {
      const { data } = await api.get(`/crm/clients/${id}`);
      setClient(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addContact = async () => {
    try {
      await api.post('/crm/contacts', { clientId: id, ...contactForm });
      setShowContactForm(false);
      setContactForm({ tipo: 'ligacao', descricao: '', duracaoMinutos: '' });
      loadClient();
    } catch (err) { console.error(err); }
  };

  const abrirNovoColab = () => {
    setColabEdit(null);
    setColabForm({
      nome: '',
      cargo: '',
      setor: '',
      email: client?.email || '',
      telefone: client?.telefone || '',
      whatsapp: client?.telefone || '',
      principal: false,
      observacoes: '',
    });
    setColabErro('');
    setShowColabForm(true);
  };
  const abrirEdicaoColab = (c: Colaborador) => {
    setColabEdit(c);
    setColabForm({ nome: c.nome, cargo: c.cargo || '', setor: c.setor || '', email: c.email || '', telefone: c.telefone || '', whatsapp: c.whatsapp || '', principal: c.principal, observacoes: c.observacoes || '' });
    setColabErro(''); setShowColabForm(true);
  };

  const salvarColab = async () => {
    setColabErro('');
    if (!colabForm.nome.trim()) { setColabErro('Nome e obrigatorio'); return; }
    setColabSaving(true);
    try {
      const payload = { nome: colabForm.nome.trim(), cargo: colabForm.cargo.trim() || null, setor: colabForm.setor.trim() || null, email: colabForm.email.trim() || null, telefone: colabForm.telefone.trim() || null, whatsapp: colabForm.whatsapp.trim() || null, principal: colabForm.principal, observacoes: colabForm.observacoes.trim() || null };
      if (colabEdit) { await api.put(`/crm/colaboradores/${colabEdit.id}`, payload); }
      else { await api.post(`/crm/clients/${id}/colaboradores`, payload); }
      setShowColabForm(false); loadClient();
    } catch (err: any) { setColabErro(err?.response?.data?.error || 'Erro ao salvar'); }
    finally { setColabSaving(false); }
  };

  const deletarColab = async (c: Colaborador) => {
    if (!confirm(`Remover "${c.nome}"?`)) return;
    try { await api.delete(`/crm/colaboradores/${c.id}`); loadClient(); } catch (err) { console.error(err); }
  };

  const marcarPrincipal = async (c: Colaborador) => {
    try { await api.post(`/crm/colaboradores/${c.id}/principal`, { valor: !c.principal }); loadClient(); } catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!client) return <div className="text-center py-12 text-gray-500">Cliente nao encontrado</div>;

  const tickets = client.tickets || [];
  const opportunities = client.opportunities || [];
  const ativos = client.ativos || [];
  const contacts = client.contacts || [];
  const serviceOrders = client.serviceOrders || [];
  const colaboradores = client.colaboradores || [];

  const ticketsAbertos = tickets.filter((t: any) => ['aberto', 'em_andamento', 'pendente', 'escalonado'].includes(t.status));
  const ticketsFechados = tickets.filter((t: any) => ['resolvido', 'fechado', 'cancelado', 'arquivado'].includes(t.status));
  const valorPipeline = opportunities.reduce((sum: number, o: any) => sum + (o.valorEstimado || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <button onClick={() => navigate('/app/crm')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
        <ArrowLeft size={18} /> Voltar
      </button>

      {/* Header Card */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 size={28} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{client.razaoSocial}</h1>
              {client.nomeFantasia && <p className="text-gray-500">{client.nomeFantasia}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`badge ${client.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{client.status}</span>
                {client.cnpjCpf && <span className="badge bg-gray-100 text-gray-600">{client.cnpjCpf}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/app/orders/new?clientId=${client.id}`)} className="btn-primary text-sm">
              <Plus size={16} className="inline mr-1" /> Nova OS
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{ticketsAbertos.length}</p>
            <p className="text-xs text-gray-500">Tickets Abertos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{ticketsFechados.length}</p>
            <p className="text-xs text-gray-500">Resolvidos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{opportunities.length}</p>
            <p className="text-xs text-gray-500">Oportunidades</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">R$ {valorPipeline.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-gray-500">Pipeline</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            <tab.icon size={15} />
            {tab.label}
            {tab.key === 'tickets' && ticketsAbertos.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">{ticketsAbertos.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">

        {/* VISAO GERAL */}
        {activeTab === 'visao_geral' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Dados Cadastrais</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {client.cnpjCpf && <div><p className="text-xs text-gray-500">CNPJ/CPF</p><p className="text-sm font-medium">{client.cnpjCpf}</p></div>}
                {client.telefone && <div><p className="text-xs text-gray-500">Telefone</p><p className="text-sm font-medium flex items-center gap-1"><Phone size={14} />{client.telefone}</p></div>}
                {client.email && <div><p className="text-xs text-gray-500">Email</p><p className="text-sm font-medium flex items-center gap-1"><Mail size={14} />{client.email}</p></div>}
                {client.cidade && <div><p className="text-xs text-gray-500">Cidade</p><p className="text-sm font-medium flex items-center gap-1"><MapPin size={14} />{client.cidade}/{client.estado}</p></div>}
                <div><p className="text-xs text-gray-500">Segmento</p><p className="text-sm font-medium">{client.segmento}</p></div>
                <div><p className="text-xs text-gray-500">Responsavel</p><p className="text-sm font-medium">{client.responsavelTecnico?.name || '-'}</p></div>
                <div><p className="text-xs text-gray-500">Origem</p><p className="text-sm font-medium">{client.origem}</p></div>
                <div><p className="text-xs text-gray-500">Colaboradores</p><p className="text-sm font-medium">{colaboradores.length} pessoa(s)</p></div>
              </div>
            </div>

            {/* Contrato */}
            {(client.tipoContrato || client.valorMensalidade || client.diaVencimento) && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Informacoes do Contrato</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {client.tipoContrato && <div><p className="text-xs text-gray-500">Tipo</p><p className="text-sm font-medium">{client.tipoContrato}</p></div>}
                  {client.valorMensalidade != null && <div><p className="text-xs text-gray-500">Mensalidade</p><p className="text-sm font-medium">R$ {client.valorMensalidade.toLocaleString('pt-BR')}</p></div>}
                  {client.diaVencimento && <div><p className="text-xs text-gray-500">Vencimento</p><p className="text-sm font-medium">Dia {client.diaVencimento}</p></div>}
                  {client.dataInicioContrato && <div><p className="text-xs text-gray-500">Inicio</p><p className="text-sm font-medium">{new Date(client.dataInicioContrato).toLocaleDateString('pt-BR')}</p></div>}
                  {client.dataFimContrato && <div><p className="text-xs text-gray-500">Fim</p><p className="text-sm font-medium">{new Date(client.dataFimContrato).toLocaleDateString('pt-BR')}</p></div>}
                </div>
              </div>
            )}

            {/* Ultimos tickets */}
            {tickets.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Ultimos Tickets</h3>
                  <button onClick={() => setActiveTab('tickets')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    Ver todos <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {tickets.slice(0, 5).map((t: any) => (
                    <div key={t.id} onClick={() => navigate(`/app/helpdesk?ticket=${t.id}`)}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">{t.protocolo || 'Sem protocolo'}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_CORES[t.status] || 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                          {t.prioridade && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORIDADE_CORES[t.prioridade] || ''}`}>{t.prioridade}</span>}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{t.assunto || t.contactName || 'Sem assunto'}</p>
                      </div>
                      <span className="text-xs text-gray-400 ml-3 whitespace-nowrap">{new Date(t.dataAbertura).toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ultimas oportunidades */}
            {opportunities.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Oportunidades</h3>
                  <button onClick={() => setActiveTab('oportunidades')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    Ver todas <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {opportunities.slice(0, 3).map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{o.titulo}</p>
                        <p className="text-xs text-gray-500">{o.etapa} — {o.probabilidade}%</p>
                      </div>
                      <span className="text-sm font-bold text-green-600">R$ {(o.valorEstimado || 0).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TICKETS */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {tickets.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <Ticket size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhum ticket encontrado para este cliente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((t: any) => (
                  <div key={t.id} onClick={() => navigate(`/app/helpdesk?ticket=${t.id}`)}
                    className="card flex items-center gap-4 p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{t.protocolo || 'Sem protocolo'}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_CORES[t.status] || 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                        {t.etapa && <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t.etapa}</span>}
                        {t.prioridade && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORIDADE_CORES[t.prioridade] || ''}`}>{t.prioridade}</span>}
                        {t.categoria && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{t.categoria}</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1">{t.assunto || t.contactName || 'Sem assunto'}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{t.contactName}</span>
                        {t.assignee && <span>Responsavel: {t.assignee.name}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{new Date(t.dataAbertura).toLocaleDateString('pt-BR')}</p>
                      <ChevronRight size={16} className="text-gray-300 mt-1 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OPORTUNIDADES */}
        {activeTab === 'oportunidades' && (
          <div className="space-y-4">
            {opportunities.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <TrendingUp size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhuma oportunidade encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {opportunities.map((o: any) => (
                  <div key={o.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{o.titulo}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>Etapa: {o.etapa}</span>
                          <span>Probabilidade: {o.probabilidade}%</span>
                          {o.responsavel && <span>Responsavel: {o.responsavel.name}</span>}
                        </div>
                      </div>
                      <span className="text-lg font-bold text-green-600">R$ {(o.valorEstimado || 0).toLocaleString('pt-BR')}</span>
                    </div>
                    {/* Barra de progresso */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${o.probabilidade || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COLABORADORES */}
        {activeTab === 'colaboradores' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={abrirNovoColab} className="btn-primary text-sm"><Plus size={14} className="inline mr-1" /> Novo Colaborador</button>
            </div>
            {colaboradores.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhum colaborador cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {colaboradores.map((c: Colaborador) => (
                  <div key={c.id} className="card flex items-start gap-3 p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-semibold">{c.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                        {c.principal && <span className="badge bg-amber-100 text-amber-700 flex items-center gap-1"><Star size={10} fill="currentColor" /> Principal</span>}
                        {c.cargo && <span className="badge bg-gray-100 text-gray-600 flex items-center gap-1"><Briefcase size={10} /> {c.cargo}</span>}
                      </div>
                      {c.setor && <p className="text-xs text-gray-500 mt-0.5">Setor: {c.setor}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        {c.email && <span className="flex items-center gap-1"><Mail size={11} /> {c.email}</span>}
                        {c.telefone && <span className="flex items-center gap-1"><Phone size={11} /> {c.telefone}</span>}
                        {c.whatsapp && <span className="flex items-center gap-1"><MessageCircle size={11} /> {c.whatsapp}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => marcarPrincipal(c)} className={`p-1.5 rounded-lg ${c.principal ? 'text-amber-500 bg-amber-50' : 'text-gray-400 hover:text-amber-500'}`} title="Principal">
                        <Star size={14} fill={c.principal ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={() => abrirEdicaoColab(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg" title="Editar"><Edit2 size={14} /></button>
                      <button onClick={() => deletarColab(c)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg" title="Remover"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ATIVOS */}
        {activeTab === 'ativos' && (
          <div className="space-y-4">
            {ativos.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <Wrench size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhum ativo (software/hardware/servico) cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ativos.map((a: any) => (
                  <div key={a.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{a.nome}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>Tipo: {a.tipo}</span>
                          {a.serial && <span>Serial: {a.serial}</span>}
                        </div>
                        {a.descricao && <p className="text-xs text-gray-400 mt-1">{a.descricao}</p>}
                      </div>
                      <span className={`badge ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTATOS */}
        {activeTab === 'contatos' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowContactForm(!showContactForm)} className="btn-primary text-sm"><Plus size={14} className="inline mr-1" /> Novo Contato</button>
            </div>
            {showContactForm && (
              <div className="card p-4 space-y-3">
                <h4 className="font-medium text-gray-900">Registrar Contato</h4>
                <select value={contactForm.tipo} onChange={(e) => setContactForm({ ...contactForm, tipo: e.target.value })} className="input text-sm">
                  <option value="ligacao">Ligacao</option>
                  <option value="visita">Visita</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="reuniao">Reuniao</option>
                </select>
                <textarea value={contactForm.descricao} onChange={(e) => setContactForm({ ...contactForm, descricao: e.target.value })}
                  className="input text-sm" placeholder="Descricao..." rows={2} />
                <input type="number" value={contactForm.duracaoMinutos} onChange={(e) => setContactForm({ ...contactForm, duracaoMinutos: e.target.value })}
                  className="input text-sm" placeholder="Duracao (min)" />
                <div className="flex gap-2">
                  <button onClick={addContact} className="btn-primary text-sm">Salvar</button>
                  <button onClick={() => setShowContactForm(false)} className="btn-secondary text-sm">Cancelar</button>
                </div>
              </div>
            )}
            {contacts.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <MessageCircle size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhum contato registrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map((c: any) => (
                  <div key={c.id} className="card flex items-start gap-3 p-4">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Calendar size={14} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 capitalize">{c.tipo}</p>
                      {c.descricao && <p className="text-sm text-gray-500">{c.descricao}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(c.data).toLocaleDateString('pt-BR')} — {c.usuario?.name} {c.duracaoMinutos ? `(${c.duracaoMinutos}min)` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ORDENS DE SERVICO */}
        {activeTab === 'os' && (
          <div className="space-y-4">
            {serviceOrders.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <FileText size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhuma ordem de servico encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {serviceOrders.map((os: any) => (
                  <div key={os.id} onClick={() => navigate(`/app/orders/${os.id}`)}
                    className="card flex items-center justify-between p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">{os.numeroOs}</p>
                      <p className="text-xs text-gray-500">{os.tipoServico} — {os.descricaoServico?.substring(0, 80)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {os.valorServico != null && <span className="text-sm font-bold text-green-600">R$ {os.valorServico.toLocaleString('pt-BR')}</span>}
                      <span className={`badge ${os.status === 'assinada' ? 'bg-green-100 text-green-700' : os.status === 'rascunho' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>{os.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Colaborador */}
      {showColabForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowColabForm(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-lg mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg text-gray-900">{colabEdit ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
              <button onClick={() => setShowColabForm(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nome completo *</label>
                <input type="text" placeholder="Ex: Maria Silva" value={colabForm.nome} onChange={(e) => setColabForm({ ...colabForm, nome: e.target.value })} className="input" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Cargo</label><input type="text" placeholder="Ex: Gerente" value={colabForm.cargo} onChange={(e) => setColabForm({ ...colabForm, cargo: e.target.value })} className="input" /></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Setor</label><input type="text" placeholder="Ex: Financeiro" value={colabForm.setor} onChange={(e) => setColabForm({ ...colabForm, setor: e.target.value })} className="input" /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Email</label><input type="email" placeholder="Ex: maria@empresa.com" value={colabForm.email} onChange={(e) => setColabForm({ ...colabForm, email: e.target.value })} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Telefone</label><input type="text" placeholder="Ex: 8533334444" value={colabForm.telefone} onChange={(e) => setColabForm({ ...colabForm, telefone: e.target.value })} className="input" /></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">WhatsApp</label><input type="text" placeholder="Ex: 85999998888" value={colabForm.whatsapp} onChange={(e) => setColabForm({ ...colabForm, whatsapp: e.target.value })} className="input" /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Observacoes</label><textarea value={colabForm.observacoes} onChange={(e) => setColabForm({ ...colabForm, observacoes: e.target.value })} className="input" rows={2} placeholder="Anotacoes..." /></div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={colabForm.principal} onChange={(e) => setColabForm({ ...colabForm, principal: e.target.checked })} className="rounded border-gray-300" />
                <Star size={14} className="text-amber-500" fill="currentColor" /> Marcar como principal
              </label>
            </div>
            {colabErro && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs"><AlertTriangle size={14} /> {colabErro}</div>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowColabForm(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
              <button onClick={salvarColab} disabled={colabSaving} className="btn-primary text-sm flex-1 disabled:opacity-50">{colabSaving ? 'Salvando...' : colabEdit ? 'Atualizar' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
