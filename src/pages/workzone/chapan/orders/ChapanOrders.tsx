import { useState, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useOrders } from '../../../../entities/order/queries';
import type { ChapanOrder, OrderStatus, Priority } from '../../../../entities/order/types';
import styles from './ChapanOrders.module.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый', confirmed: 'Подтверждён', in_production: 'В цехе',
  ready: 'Готов', transferred: 'Передан', completed: 'Завершён', cancelled: 'Отменён',
};
const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#7C3AED', confirmed: '#3B82F6', in_production: '#F59E0B',
  ready: '#10B981', transferred: '#8B5CF6', completed: '#4A5268',
  cancelled: '#EF4444',
};
const PAY_LABEL: Record<string, string> = { not_paid: 'Не оплачен', partial: 'Частично', paid: 'Оплачен' };
const PAY_COLOR: Record<string, string> = { not_paid: '#EF4444', partial: '#F59E0B', paid: '#10B981' };
const PRIORITY_LABEL: Record<Priority, string> = { normal: '', urgent: '🔴 Срочно', vip: '⭐ VIP' };

function fmt(n: number) { return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸'; }
function isOverdue(d: string | null) { return !!d && new Date(d) < new Date(); }
function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' });
}

export default function ChapanOrdersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payFilter, setPayFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const deferred = useDeferredValue(search);

  const { data, isLoading, isError } = useOrders({
    search: deferred || undefined,
    status: statusFilter || undefined,
    paymentStatus: payFilter || undefined,
    limit: 100,
  });
  const orders: ChapanOrder[] = data?.results ?? [];

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Номер, клиент, модель..." />
        </div>
        <div className={styles.toolbarRight}>
          <button className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`} onClick={() => setShowFilters(v => !v)}>
            <SlidersHorizontal size={13} /><span>Фильтры</span>
            {(statusFilter || payFilter) && <span className={styles.filterDot} />}
          </button>
          <button className={styles.newBtn} onClick={() => navigate('/workzone/chapan/orders/new')}>
            <Plus size={14} /> Новый заказ
          </button>
        </div>
      </div>

      {showFilters && (
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Статус</label>
            <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Все</option>
              {(Object.entries(STATUS_LABEL) as [OrderStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Оплата</label>
            <select className={styles.filterSelect} value={payFilter} onChange={e => setPayFilter(e.target.value)}>
              <option value="">Все</option>
              {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {(statusFilter || payFilter) && (
            <button className={styles.clearFilters} onClick={() => { setStatusFilter(''); setPayFilter(''); }}>Сбросить</button>
          )}
        </div>
      )}

      {!isLoading && <div className={styles.count}>{data?.count ?? 0} заказов</div>}
      {isLoading && <div className={styles.loading}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className={styles.skeleton} />)}</div>}
      {isError && <div className={styles.error}>Не удалось загрузить заказы</div>}

      {!isLoading && !isError && orders.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>{search || statusFilter || payFilter ? 'Ничего не найдено' : 'Заказов пока нет'}</div>
          <div className={styles.emptyText}>{search || statusFilter || payFilter ? 'Измените фильтры' : 'Создайте первый заказ'}</div>
          {!search && !statusFilter && !payFilter && (
            <button className={styles.emptyAction} onClick={() => navigate('/workzone/chapan/orders/new')}>+ Создать заказ</button>
          )}
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <div className={styles.grid}>
          {orders.map(o => <OrderCard key={o.id} order={o} onClick={() => navigate(`/workzone/chapan/orders/${o.id}`)} />)}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onClick }: { order: ChapanOrder; onClick: () => void }) {
  const overdue = isOverdue(order.dueDate);
  const first = order.items?.[0];
  const more = (order.items?.length ?? 0) - 1;

  return (
    <button className={styles.card} style={{ '--status-color': STATUS_COLOR[order.status] } as React.CSSProperties} onClick={onClick}>
      <div className={styles.cardHead}>
        <span className={styles.cardNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
        {order.priority !== 'normal' && (
          <span className={`${styles.priorityBadge} ${order.priority === 'vip' ? styles.vip : styles.urgent}`}>
            {PRIORITY_LABEL[order.priority]}
          </span>
        )}
      </div>
      <div className={styles.cardClient}>{order.clientName}</div>
      <a href={`tel:${order.clientPhone}`} className={styles.cardPhone} onClick={e => e.stopPropagation()}>{order.clientPhone}</a>
      {first && (
        <div className={styles.cardItems}>
          <span className={styles.cardItemName}>{first.productName}</span>
          {(first.fabric || first.size) && (
            <span className={styles.cardItemMeta}>{[first.fabric, first.size].filter(Boolean).join(' · ')}{first.quantity > 1 && ` × ${first.quantity}`}</span>
          )}
          {more > 0 && <span className={styles.cardMoreItems}>+ещё {more}</span>}
        </div>
      )}
      <div className={styles.cardDivider} />
      <div className={styles.cardFoot}>
        <span className={styles.cardAmount}>{fmt(order.totalAmount)}</span>
        <span className={styles.cardPay} style={{ color: PAY_COLOR[order.paymentStatus] }}>{PAY_LABEL[order.paymentStatus]}</span>
        {order.dueDate && (
          <span className={styles.cardDate} style={{ color: overdue ? '#EF4444' : '#4A5268' }}>
            {overdue ? '⚠ ' : ''}{fmtDate(order.dueDate)}
          </span>
        )}
      </div>
    </button>
  );
}
