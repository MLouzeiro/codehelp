import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/auth';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard/Dashboard';
import ClientList from './pages/CRM/ClientList';
import ClientForm from './pages/CRM/ClientForm';
import ClientDetail from './pages/CRM/ClientDetail';
import CRMThemes from './pages/CRM/CRMThemes';
import OpportunityPipeline from './pages/CRM/OpportunityPipeline';
import OrderList from './pages/Orders/OrderList';
import OrderForm from './pages/Orders/OrderForm';
import OrderDetail from './pages/Orders/OrderDetail';
import SignPage from './pages/Sign/SignPage';
import WhatsAppPage from './pages/WhatsApp/WhatsAppPage';
import TicketDetail from './pages/WhatsApp/TicketDetail';
import KanbanPage from './pages/Kanban/KanbanPage';
import SettingsPage from './pages/Settings/SettingsPage';
import UsersPage from './pages/Settings/UsersPage';
import AlertsPage from './pages/Settings/AlertsPage';
import HelpdeskStagesPage from './pages/Settings/HelpdeskStagesPage';
import HelpdeskConfigPage from './pages/Settings/HelpdeskConfigPage';
import HelpdeskDepartamentosPage from './pages/Settings/HelpdeskDepartamentosPage';
import HelpdeskFilasPage from './pages/Settings/HelpdeskFilasPage';
import HelpdeskNiveisPage from './pages/Settings/HelpdeskNiveisPage';
import PermissionsPage from './pages/Settings/PermissionsPage';
import FeriadosPage from './pages/Settings/FeriadosPage';
import AlertSettings from './pages/Settings/AlertSettings';
import RobosPage from './pages/Robos/RobosPage';
import HelpdeskKanban from './pages/Helpdesk/HelpdeskKanban';
import HelpdeskDashboard from './pages/Helpdesk/HelpdeskDashboard';
import HelpdeskMetrics from './pages/Helpdesk/HelpdeskMetrics';
import HelpdeskStatusBoard from './pages/Helpdesk/HelpdeskStatusBoard';
import AuditStatsPage from './pages/Helpdesk/AuditStatsPage';
import Aprovacoes from './pages/Helpdesk/Aprovacoes';
import KBList from './pages/KB/KBList';
import AutomationsPage from './pages/Automations/AutomationsPage';
import Layout from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" /><span className="text-sm text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando...</span></div></div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/assinar/:token" element={<SignPage />} />
        <Route path="/app" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/app/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="crm" element={<ClientList />} />
          <Route path="crm/:id" element={<ClientDetail />} />
          <Route path="crm/new" element={<ClientForm />} />
          <Route path="crm/:id/edit" element={<ClientForm />} />
          <Route path="crm/pipeline" element={<OpportunityPipeline />} />
          <Route path="crm/temas" element={<CRMThemes />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="orders/new" element={<OrderForm />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="orders/:id/edit" element={<OrderForm />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="whatsapp/tickets/:id" element={<TicketDetail />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="helpdesk" element={<HelpdeskKanban />} />
          <Route path="helpdesk/painel" element={<HelpdeskDashboard />} />
          <Route path="helpdesk/metrics" element={<HelpdeskMetrics />} />
          <Route path="helpdesk/board" element={<HelpdeskStatusBoard />} />
          <Route path="helpdesk/audit" element={<AuditStatsPage />} />
          <Route path="helpdesk/aprovacoes" element={<Aprovacoes />} />
          <Route path="kb" element={<KBList />} />
          <Route path="automations" element={<AutomationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/users" element={<UsersPage />} />
          <Route path="settings/alerts" element={<AlertsPage />} />
          <Route path="settings/helpdesk-stages" element={<HelpdeskStagesPage />} />
          <Route path="settings/helpdesk-config" element={<HelpdeskConfigPage />} />
          <Route path="settings/helpdesk-departamentos" element={<HelpdeskDepartamentosPage />} />
          <Route path="settings/helpdesk-filas" element={<HelpdeskFilasPage />} />
          <Route path="settings/helpdesk-niveis" element={<HelpdeskNiveisPage />} />
          <Route path="settings/permissions" element={<PermissionsPage />} />
          <Route path="settings/feriados" element={<FeriadosPage />} />
          <Route path="settings/alert-settings" element={<AlertSettings />} />
          <Route path="robos" element={<RobosPage />} />
        </Route>
        </Routes>
      </AuthProvider>
  );
}
