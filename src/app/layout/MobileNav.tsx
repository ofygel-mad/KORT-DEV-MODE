import { NavLink } from 'react-router-dom';
import { Layers, Users, Briefcase, CheckSquare, MoreHorizontal } from 'lucide-react';
import styles from './MobileNav.module.css';

const NAV_ITEMS = [
  { to: '/',           icon: Layers,       label: 'Канвас', end: true },
  { to: '/crm/leads',  icon: Users,        label: 'Лиды' },
  { to: '/crm/deals',  icon: Briefcase,    label: 'Сделки' },
  { to: '/crm/tasks',  icon: CheckSquare,  label: 'Задачи' },
  { to: '/settings',   icon: MoreHorizontal, label: 'Ещё' },
];

export function MobileNav() {
  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
