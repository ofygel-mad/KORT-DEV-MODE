import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Archive, CheckCheck, ChevronLeft, Factory, Package, Trash2, Warehouse } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth';
import { useChapanPermissions } from '../../../shared/hooks/useChapanPermissions';
import { ThemeSwitcher } from '../../../shared/ui/ThemeSwitcher';
import { useChapanUiStore } from '../../../features/workzone/chapan/store';
import ChapanInvoicesDrawer from './invoices/ChapanInvoicesDrawer';
import styles from './ChapanShell.module.css';
import { useEmployeePermissions } from '../../../shared/hooks/useEmployeePermissions';

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
            <NavLink
              to="/workzone/chapan/orders"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
            >
              <Package size={14} />
              <span>Заказы</span>
            </NavLink>

            <NavLink
              to="/workzone/chapan/production"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
            >
              <Factory size={14} />
              <span>Производство</span>
            </NavLink>

            <NavLink
              to="/workzone/chapan/ready"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
            >
              <CheckCheck size={14} />
              <span>Готово</span>
            </NavLink>

            {(isAdmin || canAccessWarehouseNav) && (
              <NavLink
                to="/warehouse"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
              >
                <Warehouse size={14} />
                <span>Склад</span>
              </NavLink>
            )}

            <NavLink
              to="/workzone/chapan/archive"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
            >
              <Archive size={14} />
              <span>Архив</span>
            </NavLink>
            {isAbsolute && (
              <NavLink
                to="/workzone/chapan/orders/trash"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
              >
                <Trash2 size={14} />
                <span>Корзина</span>
              </NavLink>
            )}
          </nav>

          <div className={styles.sidebarBottom} />
        </aside>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      <ChapanInvoicesDrawer open={invoicesDrawerOpen} onClose={() => setInvoicesDrawerOpen(false)} initialFilter={invoicesDrawerFilter as 'all' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'archived'} />
    </div>
  );
}
