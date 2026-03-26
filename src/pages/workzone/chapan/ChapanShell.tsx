import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Archive, CheckCheck, ChevronLeft, Factory, Package, Settings, Warehouse } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth';
import { useEmployeePermissions } from '../../../shared/hooks/useEmployeePermissions';
import { ThemeSwitcher } from '../../../shared/ui/ThemeSwitcher';
import styles from './ChapanShell.module.css';

export default function ChapanShell() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.membership.role);
  const isAdmin = role === 'owner' || role === 'admin';
  const { canAccessWarehouse } = useEmployeePermissions();

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <button className={styles.kortBack} onClick={() => navigate('/')}>
          <ChevronLeft size={14} />
          <span>На главную</span>
        </button>
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

            {(isAdmin || canAccessWarehouse) && (
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

            {isAdmin && (
              <NavLink
                to="/workzone/chapan/settings"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
              >
                <Settings size={14} />
                <span>Настройки</span>
              </NavLink>
            )}
          </nav>

          <div className={styles.sidebarBottom} />
        </aside>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
