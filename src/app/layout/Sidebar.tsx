import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart2, Briefcase, Building2, CheckSquare, LogOut,
  Settings, Users, Warehouse, Layers, User, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../shared/stores/auth';
import { KortLogo } from '../../shared/ui/KortLogo';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}

const CRM_ITEMS: NavItem[] = [
  { to: '/crm/leads',     icon: Users,     label: 'Лиды' },
  { to: '/crm/deals',     icon: Briefcase, label: 'Сделки' },
  { to: '/crm/customers', icon: User,      label: 'Клиенты' },
  { to: '/crm/tasks',     icon: CheckSquare, label: 'Задачи' },
];

const OPS_ITEMS: NavItem[] = [
  { to: '/warehouse',  icon: Warehouse,   label: 'Склад' },
  { to: '/finance',    icon: BarChart2,   label: 'Финансы' },
  { to: '/employees',  icon: Building2,   label: 'Сотрудники' },
];

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div className={styles.navGroup}>
      <div className={styles.navGroupLabel}>{label}</div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
          }
        >
          <item.icon size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function handleLogout() {
    clearAuth();
    navigate('/auth/login', { replace: true });
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <KortLogo size={28} />
        <span className={styles.logoText}>KORT</span>
      </div>

      <nav className={styles.nav}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
        >
          <Layers size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Канвас</span>
        </NavLink>

        <NavGroup label="CRM" items={CRM_ITEMS} />
        <NavGroup label="Операции" items={OPS_ITEMS} />

        <div className={styles.navGroup}>
          <div className={styles.navGroupLabel}>Аналитика</div>
          <NavLink
            to="/reports"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
          >
            <BarChart2 size={15} className={styles.navIcon} />
            <span className={styles.navLabel}>Отчёты</span>
          </NavLink>
        </div>

        <div className={styles.navDivider} />

        {/* Chapan Workzone — external link */}
        <NavLink
          to="/workzone/chapan"
          className={({ isActive }) => `${styles.navItem} ${styles.navItemChapan} ${isActive ? styles.navItemActive : ''}`}
        >
          <Layers size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Чапан</span>
          <ChevronRight size={11} className={styles.navExternalIcon} />
        </NavLink>
      </nav>

      <div className={styles.bottom}>
        <NavLink
          to="/settings"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
        >
          <Settings size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Настройки</span>
        </NavLink>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={14} />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );
}
