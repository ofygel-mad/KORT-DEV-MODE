import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Archive, CheckCheck, ChevronLeft, Factory, Package, Trash2, Warehouse } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth';
import { useChapanPermissions } from '../../../shared/hooks/useChapanPermissions';
import { ThemeSwitcher } from '../../../shared/ui/ThemeSwitcher';
import { useChapanUiStore } from '../../../features/workzone/chapan/store';
import ChapanInvoicesDrawer from './invoices/ChapanInvoicesDrawer';
import styles from './ChapanShell.module.css';
import { useEmployeePermissions } from '../../../shared/hooks/useEmployeePermissions';

const BASE_NAV = [
  { to: '/workzone/chapan/orders',     label: 'Заказы',       icon: Package  },
  { to: '/workzone/chapan/production', label: 'Производство', icon: Factory  },
  { to: '/workzone/chapan/ready',      label: 'Готово',       icon: CheckCheck },
  { to: '/workzone/chapan/archive',    label: 'Архив',        icon: Archive  },
] as const;

export default function ChapanShell() {
  const { isAbsolute } = useEmployeePermissions();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.membership.role);
  const isAdmin = role === 'owner' || role === 'admin';
  const { canAccessWarehouseNav } = useChapanPermissions();
  const selectedOrderId = useChapanUiStore((s) => s.selectedOrderId);
  const invoicesDrawerOpen = useChapanUiStore((s) => s.invoicesDrawerOpen);
  const invoicesDrawerFilter = useChapanUiStore((s) => s.invoicesDrawerFilter);
  const setInvoicesDrawerOpen = useChapanUiStore((s) => s.setInvoicesDrawerOpen);

  const navItems = [
    ...BASE_NAV,
    ...((isAdmin || canAccessWarehouseNav) ? [{ to: '/warehouse' as const,                       label: 'Склад',   icon: Warehouse }] : []),
    ...(isAbsolute                         ? [{ to: '/workzone/chapan/orders/trash' as const,     label: 'Корзина', icon: Trash2   }] : []),
  ];

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        {selectedOrderId ? (
          <button className={styles.kortBackGreen} onClick={() => navigate(-1)}>
            <ChevronLeft size={14} />
            <span>Назад</span>
          </button>
        ) : (
          <button className={styles.kortBack} onClick={() => navigate('/')}>
            <ChevronLeft size={14} />
            <span>На главную</span>
          </button>
        )}
        <div className={styles.topbarRight}>
          <ThemeSwitcher />
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.logoWrap}>
            <span className={styles.logoText}>Чапан</span>
            <span className={styles.logoSub}>Управление производством</span>
          </div>

          <nav className={styles.nav}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className={styles.sidebarBottom} />
        </aside>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      <ChapanInvoicesDrawer open={invoicesDrawerOpen} onClose={() => setInvoicesDrawerOpen(false)} initialFilter={invoicesDrawerFilter as 'all' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'archived'} />

      {/* Mobile bottom navigation — hidden on desktop via CSS */}
      <nav className={styles.mobileNav}>
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
