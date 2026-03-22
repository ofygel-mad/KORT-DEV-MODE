import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart2,
  ChevronLeft,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  Shield,
  Upload,
  Zap,
} from 'lucide-react';
import { useCapabilities } from '../../shared/hooks/useCapabilities';
import { useUIStore } from '../../shared/stores/ui';
import { useAuthStore } from '../../shared/stores/auth';
import { useWorkspaceStore } from '../../features/workspace/model/store';
import { KortLogo } from '../../shared/ui/KortLogo';
import { Tooltip } from '../../shared/ui/Tooltip';
import { OrgSwitcher } from '../../shared/ui/OrgSwitcher';
import styles from './Sidebar.module.css';
import { t } from '../../shared/motion/presets';

const NAV_MAIN = [
  { to: '/', icon: LayoutDashboard, label: 'Главная', always: true },
];

const NAV_SECONDARY = [
  { to: '/reports', icon: BarChart2, label: 'Отчёты', cap: 'reports.basic' },
  { to: '/imports', icon: Upload, label: 'Импорт', cap: 'customers.import' },
  { to: '/automations', icon: Zap, label: 'Автоматизации', cap: 'automations.manage', adminOnly: true },
  { to: '/audit', icon: Shield, label: 'Аудит', cap: 'audit.read', adminOnly: true },
];

const label = (text: string, collapsed: boolean) => (
  <AnimatePresence initial={false}>
    {!collapsed && (
      <motion.span
        className={styles.navLabel}
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: 'auto' }}
        exit={{ opacity: 0, width: 0 }}
        transition={t.fast}
      >
        {text}
      </motion.span>
    )}
  </AnimatePresence>
);

function ScrollCueGlyph({ direction }: { direction: 'up' | 'down' }) {
  const path = direction === 'up' ? 'M2 10 L9 3 L16 10' : 'M2 3 L9 10 L16 3';

  return (
    <svg
      viewBox="0 0 18 12"
      className={styles.scrollCueGlyph}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const asideRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const collapseTimerRef = useRef<number | null>(null);
  const isPointerInsideRef = useRef(false);
  const [scrollCueState, setScrollCueState] = useState({
    hasOverflow: false,
    canScrollUp: false,
    canScrollDown: false,
  });

  const { can } = useCapabilities();
  const { sidebarCollapsed, toggleSidebar, openWorkspaceAddMenu } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isUnlocked = useAuthStore((state) => state.isUnlocked);
  const alignTilesToGrid = useWorkspaceStore((state) => state.alignTilesToGrid);
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/';
  const collapsed = sidebarCollapsed;

  const secondaryVisible = useMemo(
    () => NAV_SECONDARY.filter((item) => item.cap && can(item.cap)),
    [can],
  );
  const scrollContentKey = useMemo(
    () => [
      collapsed ? 'c' : 'e',
      isDashboard ? 'dashboard' : 'section',
      isUnlocked ? 'unlocked' : 'locked',
      secondaryVisible.map(({ to }) => to).join('|'),
      Boolean(user),
    ].join(':'),
    [collapsed, isDashboard, isUnlocked, secondaryVisible, user],
  );

  const handleSignOut = () => {
    clearAuth();
    navigate('/', { replace: true });
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    [styles.navItem, isActive ? styles.navItemActive : ''].join(' ');

  const clearAutoCollapse = useCallback(() => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  const scheduleAutoCollapse = useCallback(() => {
    clearAutoCollapse();
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null;
      const state = useUIStore.getState();
      if (!state.sidebarCollapsed && !isPointerInsideRef.current) {
        state.toggleSidebar();
      }
    }, 4000);
  }, [clearAutoCollapse]);

  useEffect(() => {
    if (collapsed) {
      clearAutoCollapse();
      return;
    }

    if (isPointerInsideRef.current) {
      clearAutoCollapse();
      return;
    }

    scheduleAutoCollapse();
    return clearAutoCollapse;
  }, [collapsed, clearAutoCollapse, scheduleAutoCollapse]);

  const updateScrollCueState = useCallback(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const { clientHeight, scrollHeight, scrollTop } = nav;
    const hasOverflow = scrollHeight - clientHeight > 18;
    const nextState = {
      hasOverflow,
      canScrollUp: hasOverflow && scrollTop > 10,
      canScrollDown: hasOverflow && scrollTop + clientHeight < scrollHeight - 10,
    };

    setScrollCueState((prevState) => (
      prevState.hasOverflow === nextState.hasOverflow
      && prevState.canScrollUp === nextState.canScrollUp
      && prevState.canScrollDown === nextState.canScrollDown
        ? prevState
        : nextState
    ));
  }, []);

  const scrollNavBy = useCallback((direction: 'up' | 'down') => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    nav.scrollBy({
      top: direction === 'down' ? Math.max(144, nav.clientHeight * 0.42) : -Math.max(144, nav.clientHeight * 0.42),
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return undefined;
    }

    const handleScroll = () => updateScrollCueState();
    const resizeObserver = new ResizeObserver(handleScroll);

    handleScroll();
    nav.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(nav);

    const frameId = window.requestAnimationFrame(handleScroll);
    const settleTimerId = window.setTimeout(handleScroll, 420);

    return () => {
      nav.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(settleTimerId);
    };
  }, [scrollContentKey, updateScrollCueState]);

  return (
    <motion.aside
      ref={asideRef}
      className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
      animate={{ width: collapsed ? 90 : 236 }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      onPointerEnter={() => {
        isPointerInsideRef.current = true;
        clearAutoCollapse();
      }}
      onPointerLeave={() => {
        isPointerInsideRef.current = false;
        if (!collapsed) {
          scheduleAutoCollapse();
        }
      }}
    >
      <div className={styles.logo}>
        <KortLogo size={28} />
        {label('Kort', collapsed)}
      </div>

      {!collapsed && <OrgSwitcher collapsed={collapsed} />}

      <div className={styles.navShell}>
        <nav ref={navRef} className={styles.nav}>
          {NAV_MAIN.map(({ to, icon: Icon, label: itemLabel }) => (
            <Tooltip key={to} content={itemLabel} disabled={!collapsed} side="right">
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                aria-label={itemLabel}
                className={navItemClass}
              >
                <span className={styles.navIcon}>
                  <Icon size={17} strokeWidth={1.75} />
                </span>
                {label(itemLabel, collapsed)}
              </NavLink>
            </Tooltip>
          ))}

          <Tooltip content={collapsed ? 'Развернуть' : 'Свернуть'} disabled={!collapsed} side="right">
            <button
              className={`${styles.navItem} ${styles.navInlineControl}`}
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'}
            >
              <span className={styles.navIcon}>
                <motion.div
                  animate={{ rotate: collapsed ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <ChevronLeft size={15} />
                </motion.div>
              </span>
              {label(collapsed ? 'Развернуть' : 'Свернуть', collapsed)}
            </button>
          </Tooltip>

          {isDashboard && isUnlocked && (
            <div className={styles.workspaceActions}>
              <Tooltip content="Создать плитку" disabled={!collapsed} side="right" stretch>
                <button
                  className={`${styles.navItem} ${styles.createTileBtn}`}
                  onClick={openWorkspaceAddMenu}
                  aria-label="Создать плитку"
                >
                  <span className={`${styles.navIcon} ${styles.createTileIcon}`}>
                    <Plus size={17} strokeWidth={2.2} />
                  </span>
                  {label('Создать плитку', collapsed)}
                </button>
              </Tooltip>

              <Tooltip content="Выровнять плитки" disabled={!collapsed} side="right" stretch>
                <button
                  className={`${styles.navItem} ${styles.workspaceActionBtn}`}
                  onClick={alignTilesToGrid}
                  aria-label="Выровнять плитки"
                >
                  <span className={styles.navIcon}>
                    <LayoutGrid size={17} strokeWidth={1.75} />
                  </span>
                  {label('Выровнять', collapsed)}
                </button>
              </Tooltip>
            </div>
          )}

          {secondaryVisible.length > 0 && (
            <>
              {!collapsed && (
                <div className={styles.navSection}>Инструменты</div>
              )}
              {secondaryVisible.map(({ to, icon: Icon, label: itemLabel }) => (
                <Tooltip key={to} content={itemLabel} disabled={!collapsed} side="right">
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    aria-label={itemLabel}
                    className={navItemClass}
                  >
                    <span className={styles.navIcon}>
                      <Icon size={17} strokeWidth={1.75} />
                    </span>
                    {label(itemLabel, collapsed)}
                  </NavLink>
                </Tooltip>
              ))}
            </>
          )}
        </nav>

        {scrollCueState.canScrollUp && <div className={`${styles.navFade} ${styles.navFadeTop}`} aria-hidden="true" />}
        {scrollCueState.canScrollDown && <div className={`${styles.navFade} ${styles.navFadeBottom}`} aria-hidden="true" />}

        {scrollCueState.canScrollUp && (
          <button
            type="button"
            className={`${styles.scrollCue} ${styles.scrollCueTop}`}
            onClick={() => scrollNavBy('up')}
            aria-label="Прокрутить список выше"
          >
            <span className={styles.scrollCueIcon}>
              <ScrollCueGlyph direction="up" />
            </span>
          </button>
        )}

        {scrollCueState.canScrollDown && (
          <button
            type="button"
            className={`${styles.scrollCue} ${styles.scrollCueBottom}`}
            onClick={() => scrollNavBy('down')}
            aria-label="Прокрутить список ниже"
          >
            <span className={styles.scrollCueIcon}>
              <ScrollCueGlyph direction="down" />
            </span>
          </button>
        )}
      </div>

      <div className={styles.bottom}>
        <Tooltip content="Завершить сессию" disabled={!collapsed} side="right">
          <button
            className={`${styles.navItem} ${styles.logoutBtn}`}
            onClick={handleSignOut}
            aria-label="Завершить сессию"
          >
            <span className={styles.navIcon}>
              <LogOut size={17} strokeWidth={1.75} />
            </span>
            {label('Завершить сессию', collapsed)}
          </button>
        </Tooltip>

        <Tooltip content="Настройки" disabled={!collapsed} side="right">
          <NavLink
            to="/settings"
            onClick={onNavigate}
            aria-label="Настройки"
            className={navItemClass}
          >
            <span className={styles.navIcon}>
              <Settings size={17} strokeWidth={1.75} />
            </span>
            {label('Настройки', collapsed)}
          </NavLink>
        </Tooltip>

        {user && !collapsed && (
          <div className={styles.userSection}>
            <div className={styles.avatar}>
              {user.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.full_name}</div>
              <div className={styles.userRole}>{user.email}</div>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
