import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ChevronLeft, Package, Factory, Settings } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth';
import styles from './ChapanShell.module.css';

export default function ChapanShell() {
  const navigate = useNavigate();
  const role = useAuthStore(s => s.membership.role);
  const isAdmin = role === 'owner' || role === 'admin';

  return (
    <div className={styles.root}>
      {/* Topbar: back button + module label. Clean, no dots, no user chip. */}
      <div className={styles.topbar}>
        <button className={styles.kortBack} onClick={() => navigate('/')}>
          <ChevronLeft size={12} />
          <span>На главную</span>
        </button>
        <div className={styles.topbarDivider} />
        <span className={styles.topbarModule}>Чапан</span>
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
