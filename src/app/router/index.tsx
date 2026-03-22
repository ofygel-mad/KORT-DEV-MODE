import { createBrowserRouter, Navigate, RouterProvider, useNavigate } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { AppShell } from '../layout/AppShell';
import { PageLoader } from '../../shared/ui/PageLoader';
import { DEV_RUNTIME_BLOCKERS_DISABLED } from '../../shared/config/devAccess';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { CompanyAccessGate } from '../../shared/ui/CompanyAccessGate';
import { useAuthStore } from '../../shared/stores/auth';
import { useCompanyAccess } from '../../shared/hooks/useCompanyAccess';
import { useRole } from '../../shared/hooks/useRole';

function makePage(imp: () => Promise<{ default: ComponentType }>) {
  const Comp = lazy(imp);
  return function LazyPage() {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Comp />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

const DashboardPage = makePage(() => import('../../pages/dashboard'));
const CustomersPage = makePage(() => import('../../pages/customers'));
const CustomerProfile = makePage(() => import('../../pages/customers/profile'));
const DealsPage = makePage(() => import('../../pages/deals'));
const DealProfile = makePage(() => import('../../pages/deals/profile'));
const TasksPage = makePage(() => import('../../pages/tasks'));
const ReportsPage = makePage(() => import('../../pages/reports'));
const AutomationsPage = makePage(() => import('../../pages/automations'));
const ImportsPage = makePage(() => import('../../pages/imports'));
const SettingsPage = makePage(() => import('../../pages/settings'));
const AuditPage = makePage(() => import('../../pages/audit'));
const AdminPage = makePage(() => import('../../pages/admin'));
const FeedPage = makePage(() => import('../../pages/feed'));
const LoginPage = makePage(() => import('../../pages/auth/login'));
const RegisterPage = makePage(() => import('../../pages/auth/register'));
const AcceptInvitePage = makePage(() => import('../../pages/auth/accept-invite'));
const OnboardingPage = makePage(() => import('../../pages/onboarding'));
const WorkzoneRequestPage = makePage(() => import('../../pages/workzone-request'));

function RequireUnlockedSession({ children }: { children: ReactNode }) {
  if (DEV_RUNTIME_BLOCKERS_DISABLED) {
    return <>{children}</>;
  }

  const user = useAuthStore((state) => state.user);
  const isUnlocked = useAuthStore((state) => state.isUnlocked);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!isUnlocked) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function RequireCompanyAccess({ children }: { children: ReactNode }) {
  if (DEV_RUNTIME_BLOCKERS_DISABLED) {
    return <>{children}</>;
  }

  const navigate = useNavigate();
  const access = useCompanyAccess();

  if (access.hasCompanyAccess) {
    return <>{children}</>;
  }

  return (
    <CompanyAccessGate
      title="Раздел временно ограничен"
      subtitle="Данные компании откроются после подключения к компании или подтверждения администратором."
      actionLabel="Открыть настройки доступа"
      action={() => navigate('/settings/company-access')}
    />
  );
}

function RequireAdminAccess({ children }: { children: ReactNode }) {
  if (DEV_RUNTIME_BLOCKERS_DISABLED) {
    return <>{children}</>;
  }

  const navigate = useNavigate();
  const access = useCompanyAccess();
  const { isAdmin } = useRole();

  if (!access.hasCompanyAccess) {
    return (
      <CompanyAccessGate
        title="Панель управления недоступна"
        subtitle="Сначала нужен подтверждённый доступ к компании."
        actionLabel="Открыть настройки доступа"
        action={() => navigate('/settings/company-access')}
      />
    );
  }

  if (!isAdmin) {
    return (
      <CompanyAccessGate
        title="Недостаточно прав"
        subtitle="Этот раздел доступен только владельцу бизнеса и администраторам компании."
        actionLabel="Вернуться в настройки"
        action={() => navigate('/settings')}
      />
    );
  }

  return <>{children}</>;
}

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'feed', element: <RequireUnlockedSession><RequireCompanyAccess><FeedPage /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'customers', element: <RequireUnlockedSession><RequireCompanyAccess><CustomersPage /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'customers/:id', element: <RequireUnlockedSession><RequireCompanyAccess><CustomerProfile /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'deals', element: <RequireUnlockedSession><RequireCompanyAccess><DealsPage /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'deals/:id', element: <RequireUnlockedSession><RequireCompanyAccess><DealProfile /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'tasks', element: <RequireUnlockedSession><RequireCompanyAccess><TasksPage /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'reports', element: <RequireUnlockedSession><RequireCompanyAccess><ReportsPage /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'imports', element: <RequireUnlockedSession><RequireCompanyAccess><ImportsPage /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'automations', element: <RequireUnlockedSession><RequireCompanyAccess><AutomationsPage /></RequireCompanyAccess></RequireUnlockedSession> },
      { path: 'audit', element: <RequireUnlockedSession><RequireAdminAccess><AuditPage /></RequireAdminAccess></RequireUnlockedSession> },
      { path: 'settings', element: <RequireUnlockedSession><SettingsPage /></RequireUnlockedSession> },
      { path: 'settings/:section', element: <RequireUnlockedSession><SettingsPage /></RequireUnlockedSession> },
      { path: 'onboarding', element: <RequireUnlockedSession><OnboardingPage /></RequireUnlockedSession> },
    ],
  },
  {
    path: '/admin',
    element: <AppShell />,
    children: [
      { index: true, element: <RequireUnlockedSession><RequireAdminAccess><AdminPage /></RequireAdminAccess></RequireUnlockedSession> },
      { path: ':section', element: <RequireUnlockedSession><RequireAdminAccess><AdminPage /></RequireAdminAccess></RequireUnlockedSession> },
    ],
  },
  { path: '/auth/login', element: <LoginPage /> },
  { path: '/auth/register', element: <RegisterPage /> },
  { path: '/auth/accept-invite', element: <AcceptInvitePage /> },
  { path: '/workzone/request', element: <WorkzoneRequestPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return (
    <ErrorBoundary>
      <RouterProvider router={appRouter} />
    </ErrorBoundary>
  );
}
