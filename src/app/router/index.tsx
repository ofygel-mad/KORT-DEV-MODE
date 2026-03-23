import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { AppShell } from '../layout/AppShell';
import { PageLoader } from '../../shared/ui/PageLoader';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { useAuthStore } from '../../shared/stores/auth';

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

// Core pages
const CanvasPage     = makePage(() => import('../../pages/canvas'));
const LeadsPage      = makePage(() => import('../../pages/crm/leads'));
const DealsPage      = makePage(() => import('../../pages/crm/deals'));
const CustomersPage  = makePage(() => import('../../pages/crm/customers'));
const TasksPage      = makePage(() => import('../../pages/crm/tasks'));
const WarehousePage  = makePage(() => import('../../pages/warehouse'));
const FinancePage    = makePage(() => import('../../pages/finance'));
const EmployeesPage  = makePage(() => import('../../pages/employees'));
const ReportsPage    = makePage(() => import('../../pages/reports'));
const SettingsPage   = makePage(() => import('../../pages/settings'));
const OnboardingPage = makePage(() => import('../../pages/onboarding'));

// Auth pages
const LoginPage       = makePage(() => import('../../pages/auth/login'));
const RegisterPage    = makePage(() => import('../../pages/auth/register'));
const AcceptInvitePage = makePage(() => import('../../pages/auth/accept-invite'));

// Chapan Workzone — own layout
const ChapanShell        = makePage(() => import('../../pages/workzone/chapan/ChapanShell'));
const ChapanOrdersPage   = makePage(() => import('../../pages/workzone/chapan/orders/ChapanOrders'));
const ChapanNewOrderPage = makePage(() => import('../../pages/workzone/chapan/orders/ChapanNewOrder'));
const ChapanOrderDetailPage = makePage(() => import('../../pages/workzone/chapan/orders/ChapanOrderDetail'));
const ChapanProductionPage = makePage(() => import('../../pages/workzone/chapan/production/ChapanProduction'));
const ChapanSettingsPage = makePage(() => import('../../pages/workzone/chapan/settings/ChapanSettings'));

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

function RequireOrg({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.membership.status);
  if (status !== 'active') return <Navigate to="/settings" replace />;
  return <>{children}</>;
}

export const appRouter = createBrowserRouter([
  // ── KORT Core ─────────────────────────────────────────
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <RequireAuth><CanvasPage /></RequireAuth>,
      },
      {
        path: 'crm/leads',
        element: <RequireAuth><RequireOrg><LeadsPage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/deals',
        element: <RequireAuth><RequireOrg><DealsPage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/customers',
        element: <RequireAuth><RequireOrg><CustomersPage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/tasks',
        element: <RequireAuth><RequireOrg><TasksPage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse',
        element: <RequireAuth><RequireOrg><WarehousePage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'finance',
        element: <RequireAuth><RequireOrg><FinancePage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'employees',
        element: <RequireAuth><RequireOrg><EmployeesPage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'reports',
        element: <RequireAuth><RequireOrg><ReportsPage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'settings',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
      {
        path: 'settings/:section',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
      {
        path: 'onboarding',
        element: <RequireAuth><OnboardingPage /></RequireAuth>,
      },
    ],
  },

  // ── Chapan Workzone — own shell, own layout ────────────
  {
    path: '/workzone/chapan',
    element: <RequireAuth><ChapanShell /></RequireAuth>,
    children: [
      {
        index: true,
        element: <Navigate to="orders" replace />,
      },
      {
        path: 'orders',
        element: <ChapanOrdersPage />,
      },
      {
        path: 'orders/new',
        element: <ChapanNewOrderPage />,
      },
      {
        path: 'orders/:id',
        element: <ChapanOrderDetailPage />,
      },
      {
        path: 'production',
        element: <ChapanProductionPage />,
      },
      {
        path: 'settings',
        element: <ChapanSettingsPage />,
      },
    ],
  },

  // ── Auth ───────────────────────────────────────────────
  { path: '/auth/login',         element: <LoginPage /> },
  { path: '/auth/register',      element: <RegisterPage /> },
  { path: '/auth/accept-invite', element: <AcceptInvitePage /> },

  // ── Fallback ───────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return (
    <ErrorBoundary>
      <RouterProvider router={appRouter} />
    </ErrorBoundary>
  );
}
