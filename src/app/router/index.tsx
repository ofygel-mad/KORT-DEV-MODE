import { createBrowserRouter, Navigate, NavLink, RouterProvider } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { AppShell } from '../layout/AppShell';
import { PageLoader } from '../../shared/ui/PageLoader';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { useAuthStore } from '../../shared/stores/auth';
import { usePlan, planIncludes, PLAN_LABELS, type OrgMode } from '../../shared/hooks/usePlan';
import { Settings } from 'lucide-react';

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
const ProductionPage = makePage(() => import('../../pages/production'));
const FinancePage    = makePage(() => import('../../pages/finance'));
const EmployeesPage  = makePage(() => import('../../pages/employees'));
const ReportsPage    = makePage(() => import('../../pages/reports'));
const DocumentsPage  = makePage(() => import('../../pages/documents'));
const SettingsPage   = makePage(() => import('../../pages/settings'));
const OnboardingPage = makePage(() => import('../../pages/onboarding'));

// Dev panel — no auth, service password only
const DevPanelPage = makePage(() => import('../../pages/dev'));

// Auth pages
const LoginPage         = makePage(() => import('../../pages/auth/login'));
const RegisterPage      = makePage(() => import('../../pages/auth/register'));
const AcceptInvitePage  = makePage(() => import('../../pages/auth/accept-invite'));
const ResetPasswordPage = makePage(() => import('../../pages/auth/reset-password'));

// Chapan Workzone — own layout
const ChapanShell        = makePage(() => import('../../pages/workzone/chapan/ChapanShell'));
const ChapanOrdersPage   = makePage(() => import('../../pages/workzone/chapan/orders/ChapanOrders'));
const ChapanNewOrderPage = makePage(() => import('../../pages/workzone/chapan/orders/ChapanNewOrder'));
const ChapanOrderDetailPage = makePage(() => import('../../pages/workzone/chapan/orders/ChapanOrderDetail'));
const ChapanEditOrderPage   = makePage(() => import('../../pages/workzone/chapan/orders/ChapanEditOrder'));
const ChapanProductionPage  = makePage(() => import('../../pages/workzone/chapan/production/ChapanProduction'));
const ChapanReadyPage       = makePage(() => import('../../pages/workzone/chapan/ready/ChapanReady'));
const ChapanInvoicesPage    = makePage(() => import('../../pages/workzone/chapan/invoices/ChapanInvoices'));
const ChapanArchivePage     = makePage(() => import('../../pages/workzone/chapan/archive/ChapanArchive'));
const ChapanTrashPage       = makePage(() => import('../../pages/workzone/chapan/orders/ChapanTrash'));

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

const PLAN_COLORS: Record<OrgMode, string> = {
  basic: '#5C8DFF',
  advanced: '#D97706',
  industrial: '#7C3AED',
};

function PlanGate({ required }: { required: OrgMode }) {
  const color = PLAN_COLORS[required];
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      textAlign: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 14%, var(--bg-surface-elevated))`,
        border: `1.5px solid color-mix(in srgb, ${color} 30%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
      }}>
        🔒
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Требуется план «{PLAN_LABELS[required]}»
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
          Этот модуль недоступен в вашем текущем режиме. Измените план в настройках организации.
        </div>
      </div>
      <NavLink
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          background: `color-mix(in srgb, ${color} 12%, var(--bg-surface))`,
          border: `1px solid color-mix(in srgb, ${color} 28%, var(--brand-panel-border))`,
          color: color,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        <Settings size={14} />
        Перейти в настройки
      </NavLink>
    </div>
  );
}

function RequirePlan({ tier, children }: { tier: OrgMode; children: ReactNode }) {
  const plan = usePlan();
  if (!planIncludes(plan, tier)) return <PlanGate required={tier} />;
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
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><DealsPage /></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/customers',
        element: <RequireAuth><RequireOrg><CustomersPage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/tasks',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><TasksPage /></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse',
        element: <RequireAuth><RequireOrg><WarehousePage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/:id',
        element: <RequireAuth><RequireOrg><ChapanOrderDetailPage /></RequireOrg></RequireAuth>,
      },
      {
        path: 'production',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><ProductionPage /></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'finance',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><FinancePage /></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'employees',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><EmployeesPage /></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'reports',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><ReportsPage /></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'documents',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><DocumentsPage /></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'settings',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
      {
        path: 'settings/:section',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
    ],
  },

  // ── Onboarding — own fullscreen layout, no sidebar ────
  {
    path: '/onboarding',
    element: <RequireAuth><OnboardingPage /></RequireAuth>,
  },

  // ── Chapan Workzone — own shell, own layout ────────────
  {
    path: '/workzone/chapan',
    element: <RequireAuth><RequirePlan tier="industrial"><ChapanShell /></RequirePlan></RequireAuth>,
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
        path: 'orders/:id/edit',
        element: <ChapanEditOrderPage />,
      },
      {
        path: 'production',
        element: <ChapanProductionPage />,
      },
      {
        path: 'ready',
        element: <ChapanReadyPage />,
      },
      {
        path: 'ready/:id',
        element: <ChapanOrderDetailPage />,
      },
      {
        path: 'invoices',
        element: <ChapanInvoicesPage />,
      },
      {
        path: 'orders/trash',
        element: <ChapanTrashPage />,
      },
      {
        path: 'archive',
        element: <ChapanArchivePage />,
      },
      {
        path: 'archive/:id',
        element: <ChapanOrderDetailPage />,
      },
      {
        path: 'settings',
        element: <Navigate to="../orders" replace />,
      },
    ],
  },

  // ── Auth ───────────────────────────────────────────────
  { path: '/auth/login',         element: <LoginPage /> },
  { path: '/auth/register',      element: <RegisterPage /> },
  { path: '/auth/accept-invite', element: <AcceptInvitePage /> },
  { path: '/reset-password',     element: <ResetPasswordPage /> },

  // ── Dev panel — service password, no normal auth ──────
  { path: '/dev', element: <DevPanelPage /> },

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
