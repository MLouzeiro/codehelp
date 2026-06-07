import { Link, useLocation } from 'react-router-dom';
import { Users, Bell, Inbox, Shield, Settings2 } from 'lucide-react';

export default function SettingsPage() {
  const location = useLocation();

  const links = [
    { path: '/app/settings/users', label: 'Usuários', icon: Users, desc: 'Gerenciar usuários e permissões' },
    { path: '/app/settings/helpdesk-stages', label: 'Etapas do Helpdesk', icon: Inbox, desc: 'Criar, renomear, ativar ou desativar etapas (somente admin master)' },
    { path: '/app/settings/alerts', label: 'Alertas', icon: Bell, desc: 'Configurar alertas semanais e destinatários' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {links.map((link) => (
          <Link key={link.path} to={link.path}
            className="card hover:shadow-md transition-shadow flex items-center gap-4 p-6">
            <div className="w-12 h-12 bg-codemed-100 rounded-xl flex items-center justify-center">
              <link.icon size={24} className="text-codemed-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{link.label}</h3>
              <p className="text-sm text-gray-500">{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
