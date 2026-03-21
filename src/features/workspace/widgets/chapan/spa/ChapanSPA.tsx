import { useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Factory,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import { useChapanStore } from '../../../../chapan-spa/model/chapan.store';
import { useTileChapanUI } from '../../../../chapan-spa/model/tile-ui.store';
import type { ChapanSection } from '../../../../chapan-spa/model/tile-ui.store';
import type { OrderPriority, OrderSortBy, OrderStatus, PaymentStatus } from '../../../../chapan-spa/api/types';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_ORDER,
  PAYMENT_STATUS_LABEL,
  PRIORITY_LABEL,
} from '../../../../chapan-spa/api/types';
import { OrderList } from '../../../../chapan-spa/components/orders/OrderList';
import { CreateOrderModal } from '../../../../chapan-spa/components/orders/CreateOrderModal';
import { OrderDrawer } from '../../../../chapan-spa/components/drawer/OrderDrawer';
import { ProductionQueue } from '../../../../chapan-spa/components/production/ProductionQueue';
import { WorkshopSettings } from '../../../../chapan-spa/components/settings/WorkshopSettings';
import { RequestInbox } from '../../../../chapan-spa/components/requests/RequestInbox';
import s from './ChapanSPA.module.css';

interface Props {
  tileId: string;
  title: string;
  onBack: () => void;
}

const SECTIONS: { id: ChapanSection; label: string; icon: typeof Factory }[] = [
  { id: 'requests', label: 'Заявки', icon: Inbox },
  { id: 'orders', label: 'Заказы', icon: ShoppingBag },
  { id: 'production', label: 'Производство', icon: Factory },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export function ChapanSPA({ tileId, title, onBack }: Props) {
  const { loading, load, orders, requests, profile } = useChapanStore();
  const ui = useTileChapanUI(tileId);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const activeOrders = orders.filter((order) => order.status !== 'cancelled' && order.status !== 'completed');
    const productionTasks = activeOrders.flatMap((order) => order.productionTasks);

    return {
      readyCount: orders.filter((order) => order.status === 'ready').length,
      blockedCount: productionTasks.filter((task) => task.isBlocked).length,
      activeRequests: requests.filter((request) => request.status === 'new' || request.status === 'reviewed').length,
    };
  }, [orders, requests]);

  if (loading) {
    return (
      <div className={s.loading}>
        <RefreshCw size={20} className={s.spin} />
        <span>Загружаю пространство цеха...</span>
      </div>
    );
  }

  return (
    <div className={s.root} data-tile-id={tileId}>
      <div className={s.topBar}>
        <div className={s.headMain}>
          <button className={s.backBtn} onClick={onBack}>
            <ArrowLeft size={15} />
            <span>К производствам</span>
          </button>
          <h1 className={s.title}>{title}</h1>
        </div>

        <div className={s.actionRow}>
          {profile.publicIntakeEnabled && (
            <button
              className={s.secondaryBtn}
              onClick={() => window.open('/workzone/request', '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink size={14} />
              Форма заявки
            </button>
          )}
          <button className={s.primaryBtn} onClick={() => ui.openCreateModal()}>
            <Plus size={14} />
            Новый заказ
          </button>
        </div>
      </div>

      <nav className={s.nav}>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`${s.navItem} ${ui.section === section.id ? s.navItemActive : ''}`}
            onClick={() => ui.setSection(section.id)}
          >
            <section.icon size={14} />
            <span>{section.label}</span>
            {section.id === 'requests' && stats.activeRequests > 0 && (
              <span className={s.navBadge}>{stats.activeRequests}</span>
            )}
            {section.id === 'production' && stats.blockedCount > 0 && (
              <span className={s.navBadge} data-tone="warning">{stats.blockedCount}</span>
            )}
            {section.id === 'orders' && stats.readyCount > 0 && (
              <span className={s.navBadge} data-tone="success">{stats.readyCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className={s.content}>
        {ui.section === 'requests' && <RequestInbox tileId={tileId} />}
        {ui.section === 'orders' && (
          <>
            <div className={s.filtersBar}>
              <div className={s.searchField}>
                <Search size={14} />
                <input
                  className={s.filterInput}
                  placeholder="Найти по коду, клиенту или изделию"
                  value={ui.searchQuery}
                  onChange={(event) => ui.setSearchQuery(event.target.value)}
                />
              </div>

              <select
                className={s.filterSelect}
                value={ui.filterStatus}
                onChange={(event) => ui.setFilterStatus(event.target.value as OrderStatus | 'all')}
              >
                <option value="all">Все статусы</option>
                {ORDER_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>{ORDER_STATUS_LABEL[status]}</option>
                ))}
                <option value="cancelled">Отменённые</option>
              </select>

              <select
                className={s.filterSelect}
                value={ui.filterPriority}
                onChange={(event) => ui.setFilterPriority(event.target.value as OrderPriority | 'all')}
              >
                <option value="all">Все приоритеты</option>
                {(Object.keys(PRIORITY_LABEL) as OrderPriority[]).map((priority) => (
                  <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>
                ))}
              </select>

              <select
                className={s.filterSelect}
                value={ui.filterPayment}
                onChange={(event) => ui.setFilterPayment(event.target.value as PaymentStatus | 'all')}
              >
                <option value="all">Вся оплата</option>
                {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((status) => (
                  <option key={status} value={status}>{PAYMENT_STATUS_LABEL[status]}</option>
                ))}
              </select>

              <select
                className={s.filterSelect}
                value={ui.sortBy}
                onChange={(event) => ui.setSortBy(event.target.value as OrderSortBy)}
              >
                <option value="createdAt">Сначала новые</option>
                <option value="dueDate">По сроку</option>
                <option value="totalAmount">По сумме</option>
                <option value="updatedAt">По последнему действию</option>
              </select>
            </div>
            <OrderList tileId={tileId} />
          </>
        )}
        {ui.section === 'production' && <ProductionQueue mode="manager" />}
        {ui.section === 'settings' && <WorkshopSettings />}
      </div>

      <OrderDrawer tileId={tileId} />
      <CreateOrderModal tileId={tileId} />
    </div>
  );
}
