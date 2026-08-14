import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/auth';
import Layout from './components/Layout';

// ── Lazy-loaded pages (code splitting) ──────────────────────────────
const Login = lazy(() => import('./pages/Login'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const ClientList = lazy(() => import('./pages/CRM/ClientList'));
const ClientesTabela = lazy(() => import('./pages/CRM/ClientesTabela'));
const ServicosContatosPage = lazy(() => import('./pages/CRM/ServicosContatosPage'));
const ClientForm = lazy(() => import('./pages/CRM/ClientForm'));
const ClientDetail = lazy(() => import('./pages/CRM/ClientDetail'));
const CRMThemes = lazy(() => import('./pages/CRM/CRMThemes'));
const OpportunityPipeline = lazy(() => import('./pages/CRM/OpportunityPipeline'));
const OrderList = lazy(() => import('./pages/Orders/OrderList'));
const OrderForm = lazy(() => import('./pages/Orders/OrderForm'));
const OrderDetail = lazy(() => import('./pages/Orders/OrderDetail'));
const SignPage = lazy(() => import('./pages/Sign/SignPage'));
const AprovacaoPublica = lazy(() => import('./pages/Aprovacoes/AprovacaoPublica'));
const WhatsAppPage = lazy(() => import('./pages/WhatsApp/WhatsAppPage'));
const TicketDetail = lazy(() => import('./pages/WhatsApp/TicketDetail'));
const KanbanPage = lazy(() => import('./pages/Kanban/KanbanPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const UsersPage = lazy(() => import('./pages/Settings/UsersPage'));
const AlertsPage = lazy(() => import('./pages/Settings/AlertsPage'));
const HelpdeskStagesPage = lazy(() => import('./pages/Settings/HelpdeskStagesPage'));
const HelpdeskConfigPage = lazy(() => import('./pages/Settings/HelpdeskConfigPage'));
const HelpdeskDepartamentosPage = lazy(() => import('./pages/Settings/HelpdeskDepartamentosPage'));
const HelpdeskFilasPage = lazy(() => import('./pages/Settings/HelpdeskFilasPage'));
const HelpdeskNiveisPage = lazy(() => import('./pages/Settings/HelpdeskNiveisPage'));
const PermissionsPage = lazy(() => import('./pages/Settings/PermissionsPage'));
const FeriadosPage = lazy(() => import('./pages/Settings/FeriadosPage'));
const AlertSettings = lazy(() => import('./pages/Settings/AlertSettings'));
const AutoMessagesPage = lazy(() => import('./pages/Settings/AutoMessagesPage'));
const EnquetesPage = lazy(() => import('./pages/Settings/EnquetesPage'));
const AIAutoAtendimentoPage = lazy(() => import('./pages/Settings/AIAutoAtendimentoPage'));
const RobosPage = lazy(() => import('./pages/Robos/RobosPage'));
const HelpdeskKanban = lazy(() => import('./pages/Helpdesk/HelpdeskKanban'));
const HelpdeskDashboard = lazy(() => import('./pages/Helpdesk/HelpdeskDashboard'));
const DashboardHelpdeskV2 = lazy(() => import('./pages/Helpdesk/DashboardHelpdeskV2'));
const HelpdeskMetrics = lazy(() => import('./pages/Helpdesk/HelpdeskMetrics'));
const HelpdeskBusinessMetrics = lazy(() => import('./pages/Dashboard/HelpdeskMetrics'));
const HelpdeskStatusBoard = lazy(() => import('./pages/Helpdesk/HelpdeskStatusBoard'));
const TicketAtendimentoPage = lazy(() => import('./pages/Helpdesk/TicketAtendimentoPage'));
const TicketRelatorio = lazy(() => import('./pages/Helpdesk/TicketRelatorio'));
const TicketTimelineExpandida = lazy(() => import('./pages/Helpdesk/TicketTimelineExpandida'));
const AuditStatsPage = lazy(() => import('./pages/Helpdesk/AuditStatsPage'));
const AuditoriaAtendimento = lazy(() => import('./pages/Helpdesk/AuditoriaAtendimento'));
const Aprovacoes = lazy(() => import('./pages/Helpdesk/Aprovacoes'));
const KBList = lazy(() => import('./pages/KB/KBList'));
const AutomationsPage = lazy(() => import('./pages/Automations/AutomationsPage'));
const ChannelsPage = lazy(() => import('./pages/Settings/ChannelsPage'));
const TimeTrackingPage = lazy(() => import('./pages/TimeTracking/TimeTrackingPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-sm text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando...</span>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/assinar/:token" element={<SignPage />} />
          <Route path="/aprovacoes/:token" element={<AprovacaoPublica />} />
          <Route path="/app" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/app/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="crm" element={<ClientList />} />
            <Route path="crm/:id" element={<ClientDetail />} />
            <Route path="crm/new" element={<ClientForm />} />
            <Route path="crm/:id/edit" element={<ClientForm />} />
            <Route path="crm/pipeline" element={<OpportunityPipeline />} />
            <Route path="crm/tabela" element={<ClientesTabela />} />
            <Route path="crm/servicos" element={<ServicosContatosPage />} />
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
            <Route path="helpdesk/painel-ia" element={<DashboardHelpdeskV2 />} />
            <Route path="helpdesk/metrics" element={<HelpdeskMetrics />} />
            <Route path="helpdesk/business-metrics" element={<HelpdeskBusinessMetrics />} />
            <Route path="helpdesk/board" element={<HelpdeskStatusBoard />} />
            <Route path="helpdesk/ticket/:ticketId" element={<TicketAtendimentoPage />} />
            <Route path="helpdesk/relatorio/:ticketId" element={<TicketRelatorio />} />
            <Route path="helpdesk/timeline/:ticketId" element={<TicketTimelineExpandida />} />
            <Route path="helpdesk/audit" element={<AuditStatsPage />} />
            <Route path="helpdesk/auditoria-ia" element={<AuditoriaAtendimento />} />
            <Route path="helpdesk/aprovacoes" element={<Aprovacoes />} />
            <Route path="kb" element={<KBList />} />
            <Route path="automations" element={<AutomationsPage />} />
            <Route path="timetracking" element={<TimeTrackingPage />} />
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
            <Route path="settings/channels" element={<ChannelsPage />} />
            <Route path="settings/auto-messages" element={<AutoMessagesPage />} />
            <Route path="settings/enquetes" element={<EnquetesPage />} />
            <Route path="settings/ai-auto-atendimento" element={<AIAutoAtendimentoPage />} />
            <Route path="robos" element={<RobosPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
