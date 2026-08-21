import { Link, useLocation } from 'react-router-dom';
import { Users, Bell, Inbox, Shield, Settings2, Lock, CalendarOff, MessageSquare, Clock, Building2, Layers, ListTodo, FileText, Bot, Radio, BarChart3, ListTree } from 'lucide-react';

export default function SettingsPage() {
  const location = useLocation();

  const links = [
    { path: '/app/settings/users', label: 'Usuários', icon: Users, desc: 'Gerenciar usuários e permissões' },
    { path: '/app/settings/permissions', label: 'Permissões', icon: Shield, desc: 'Matriz de permissões por role (somente admin master)' },
    { path: '/app/settings/helpdesk-config', label: 'Helpdesk', icon: MessageSquare, desc: 'Mensagens automáticas, menu e horário de funcionamento' },
    { path: '/app/settings/auto-messages', label: 'Mensagens Automáticas', icon: FileText, desc: 'Editar todas as mensagens enviadas pela plataforma' },
    { path: '/app/settings/enquetes', label: 'Enquetes e Listas', icon: BarChart3, desc: 'Criar enquetes e listas interativas para enviar aos clientes' },
    { path: '/app/settings/ai-auto-atendimento', label: 'Auto-Atendimento IA', icon: Bot, desc: 'Configurar atendimento automatizado por inteligência artificial' },
    { path: '/app/settings/helpdesk-stages', label: 'Etapas do Helpdesk', icon: Inbox, desc: 'Criar, renomear, ativar ou desativar etapas (somente admin master)' },
    { path: '/app/settings/helpdesk-departamentos', label: 'Departamentos', icon: Building2, desc: 'Gerenciar setores: Suporte, Comercial, Desenvolvimento, Demandas Internas' },
    { path: '/app/settings/helpdesk-filas', label: 'Filas', icon: ListTodo, desc: 'Gerenciar filas de atendimento por departamento e nível' },
    { path: '/app/settings/categorias-assuntos', label: 'Categorias e Assuntos', icon: ListTree, desc: 'Classificação do helpdesk: categorias, assuntos, SLA e prioridade padrão' },
    { path: '/app/settings/helpdesk-niveis', label: 'Níveis de Suporte', icon: Layers, desc: 'Configurar níveis: N1, N2, N3, Supervisor, etc.' },
    { path: '/app/settings/feriados', label: 'Feriados', icon: CalendarOff, desc: 'Cadastrar feriados para bloquear atendimento fora do horário comercial' },
    { path: '/app/settings/alerts', label: 'Alertas', icon: Bell, desc: 'Configurar alertas semanais e destinatários' },
    { path: '/app/settings/alert-settings', label: 'Alertas Atendente', icon: Bell, desc: 'Configurar alertas sonoros e notificações' },
    { path: '/app/settings/channels', label: 'Canais de Atendimento', icon: Radio, desc: 'Gerenciar WhatsApp, E-mail, Instagram, Facebook e outros canais' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Configurações</h1>
        <p className="text-gray-500 dark:text-slate-400">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {links.map((link) => (
          <Link key={link.path} to={link.path}
            className="card hover:shadow-md transition-shadow flex items-center gap-4 p-6">
            <div className="w-12 h-12 bg-codemed-100 rounded-xl flex items-center justify-center">
              <link.icon size={24} className="text-codemed-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">{link.label}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
