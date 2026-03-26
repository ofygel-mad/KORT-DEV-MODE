import { useState, useDeferredValue, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, LayoutGrid, Layers, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useOrders } from '../../../../entities/order/queries';
import type { ChapanOrder, OrderStatus, Priority } from '../../../../entities/order/types';
import { useProductsAvailability } from '../../../../entities/warehouse/queries';
import type { ProductsAvailabilityMap } from '../../../../entities/warehouse/types';
import { useAuthStore } from '@/shared/stores/auth';
import { useChapanUiStore } from '../../../../features/workzone/chapan/store';
import { useUnpaidAlerts } from '../../../../entities/alert/queries';
import OrderDetailDrawer from './OrderDetailDrawer';
import styles from './ChapanOrders.module.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый', confirmed: 'Подтверждён', in_production: 'В цехе',
  ready: 'Готов', transferred: 'Передан', on_warehouse: 'На складе',
  shipped: 'Отправлен', completed: 'Завершён', cancelled: 'Отменён',
};

const ACTIVE_STATUSES: OrderStatus[] = ['new', 'confirmed', 'in_production', 'ready', 'shipped'];
const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#7C3AED', confirmed: '#3B82F6', in_production: '#F59E0B',
  ready: '#10B981', transferred: '#8B5CF6', on_warehouse: '#8B5CF6',
  shipped: '#3B82F6', completed: '#4A5268',
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

type ViewMode = 'grid' | 'list';

const VIEW_OPTIONS: { key: ViewMode; label: string; Icon: React.ElementType }[] = [
  { key: 'grid', label: 'Плитки', Icon: LayoutGrid },
  { key: 'list', label: 'Список', Icon: List },
];

function viewStorageKey(userId?: string) { return `chapan_orders_view_${userId ?? 'guest'}`; }
function groupStorageKey(userId?: string) { return `chapan_orders_grouped_${userId ?? 'guest'}`; }

// ── Grouping logic ────────────────────────────────────────────────────────────

const BATCH_WINDOW_DAYS = 2;

type DisplayGroup =
  | { kind: 'single'; order: ChapanOrder }
  | { kind: 'batch'; orders: ChapanOrder[] };

function groupSignature(order: ChapanOrder): string {
  const first = order.items?.[0];
  if (!first) return `@@${order.id}`;
  const p = first.productName?.toLowerCase().trim() ?? '';
  const f = first.fabric?.toLowerCase().trim() ?? '';
  const s = first.size?.toLowerCase().trim() ?? '';
  return `${p}|${f}|${s}|${order.status}|${order.priority}`;
}

function buildGroups(orders: ChapanOrder[]): DisplayGroup[] {
  const buckets = new Map<string, ChapanOrder[]>();
  for (const o of orders) {
    const key = groupSignature(o);
    const arr = buckets.get(key) ?? [];
    arr.push(o);
    buckets.set(key, arr);
  }
  const result: DisplayGroup[] = [];
  for (const [, bucket] of buckets) {
    if (bucket.length === 1) { result.push({ kind: 'single', order: bucket[0] }); continue; }
    const withDate = bucket.filter(o => o.dueDate).sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
    const noDate = bucket.filter(o => !o.dueDate);
    const clusters: ChapanOrder[][] = [];
    let cur: ChapanOrder[] = [];
    for (const o of withDate) {
      if (!cur.length) { cur.push(o); continue; }
      if ((+new Date(o.dueDate!) - +new Date(cur[0].dueDate!)) / 86_400_000 <= BATCH_WINDOW_DAYS) {
        cur.push(o);
      } else {
        clusters.push(cur); cur = [o];
      }
    }
    if (cur.length) clusters.push(cur);
    if (noDate.length) clusters.push(noDate);
    for (const c of clusters) {
      if (c.length === 1) result.push({ kind: 'single', order: c[0] });
      else result.push({ kind: 'batch', orders: c });
    }
  }
  return result;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChapanOrdersPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const { selectedOrderId, setSelectedOrderId } = useChapanUiStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payFilter, setPayFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [grouped, setGroupedState] = useState(true);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const viewPickerRef = useRef<HTMLDivElement>(null);

  const { data: alertsData } = useUnpaidAlerts();
  const alerts = alertsData?.results ?? [];
  const activeAlertOrderIds = new Set(alerts.map(a => a.orderId));

  const deferred = useDeferredValue(search);
  const hasActiveFilters = Boolean(search || statusFilter || payFilter);

  useEffect(() => {
    const savedView = localStorage.getItem(viewStorageKey(userId));
    if (savedView === 'grid' || savedView === 'list') setViewModeState(savedView);
    const savedGroup = localStorage.getItem(groupStorageKey(userId));
    if (savedGroup !== null) setGroupedState(savedGroup !== 'false');
  }, [userId]);

  // Restore selected order from store when returning to this page
  useEffect(() => {
    if (selectedOrderId) {
      navigate(`/workzone/chapan/orders/${selectedOrderId}`);
    }
    // Empty dependency array - only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showViewMenu) return;
    const handle = (e: MouseEvent) => {
      if (!viewPickerRef.current?.contains(e.target as Node)) setShowViewMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showViewMenu]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    setShowViewMenu(false);
    localStorage.setItem(viewStorageKey(userId), mode);
  };

  const toggleGrouped = () => {
    setGroupedState(v => {
      localStorage.setItem(groupStorageKey(userId), String(!v));
      return !v;
    });
  };

  const { data, isLoading, isError } = useOrders({
    search: deferred || undefined,
    status: statusFilter || undefined,
    paymentStatus: payFilter || undefined,
    archived: false,
    limit: 100,
  });
  const orders: ChapanOrder[] = data?.results ?? [];

  const newProductNames = [
    ...new Set(
      orders
        .filter((o) => o.status === 'new' || o.status === 'confirmed')
        .flatMap((o) => (o.items ?? []).map((i) => i.productName).filter((n): n is string => !!n)),
    ),
  ];
  const { data: stockMap } = useProductsAvailability(newProductNames);

  const showToolbarCreateButton =
    isLoading || isError || hasActiveFilters || (data?.count ?? 0) > 0;

  const displayGroups: DisplayGroup[] = grouped ? buildGroups(orders) : orders.map(o => ({ kind: 'single', order: o }));
  const batchCount = displayGroups.filter(g => g.kind === 'batch').length;

  const currentView = VIEW_OPTIONS.find(v => v.key === viewMode)!;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Номер, клиент, модель..."
          />
        </div>
        <div className={styles.toolbarRight}>
          {/* View picker */}
          <div className={styles.viewPickerWrap} ref={viewPickerRef}>
            <button
              className={`${styles.viewBtn} ${showViewMenu ? styles.viewBtnOpen : ''}`}
              onClick={() => setShowViewMenu(v => !v)}
              title="Изменить вид отображения"
            >
              <currentView.Icon size={13} />
              <span>Вид</span>
            </button>
            {showViewMenu && (
              <div className={styles.viewMenu}>
                <div className={styles.viewMenuTitle}>Отображение</div>
                {VIEW_OPTIONS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    className={`${styles.viewMenuItem} ${viewMode === key ? styles.viewMenuItemActive : ''}`}
                    onClick={() => setViewMode(key)}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                    {viewMode === key && <Check size={11} className={styles.viewMenuCheck} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grouping toggle */}
          <button
            className={`${styles.groupToggle} ${grouped ? styles.groupToggleActive : ''}`}
            onClick={toggleGrouped}
            title={grouped ? 'Отключить группировку' : 'Группировать похожие заказы'}
          >
            <Layers size={13} />
            <span>Группировать</span>
            {grouped && batchCount > 0 && <span className={styles.groupDot}>{batchCount}</span>}
          </button>

          <button
            className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal size={13} /><span>Фильтры</span>
            {(statusFilter || payFilter) && <span className={styles.filterDot} />}
          </button>

          {/* Alerts bell icon */}
          <button
            className={styles.alertsBtn}
            onClick={() => setShowAlertsPanel(!showAlertsPanel)}
            title={alerts.length > 0 ? `${alerts.length} неоплаченных заказов` : 'Нет активных алертов'}
            style={{
              position: 'relative',
              padding: '6px 10px',
              borderRadius: '8px',
              background: alerts.length > 0 ? 'rgba(217, 79, 79, 0.1)' : 'transparent',
              border: alerts.length > 0 ? '1px solid rgba(217, 79, 79, 0.25)' : '1px solid transparent',
              color: alerts.length > 0 ? '#D94F4F' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 140ms',
            }}
          >
            <Bell size={13} />
            {alerts.length > 0 && <span>{alerts.length}</span>}
          </button>

          {showToolbarCreateButton && (
            <button className={styles.newBtn} onClick={() => navigate('/workzone/chapan/orders/new')}>
              <Plus size={14} /> Новый заказ
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Статус</label>
            <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Все активные</option>
              {ACTIVE_STATUSES.map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
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

      {!isLoading && (
        <div className={styles.count}>
          {data?.count ?? 0} заказов
          {grouped && batchCount > 0 && <span className={styles.countBatch}> · {batchCount} групп</span>}
        </div>
      )}
      {isLoading && <div className={styles.loading}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className={styles.skeleton} />)}</div>}
      {isError && <div className={styles.error}>Не удалось загрузить заказы</div>}

      {!isLoading && !isError && orders.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>{hasActiveFilters ? 'Ничего не найдено' : 'Заказов пока нет'}</div>
          <div className={styles.emptyText}>{hasActiveFilters ? 'Измените фильтры' : 'Создайте первый заказ'}</div>
          {!hasActiveFilters && (
            <button className={styles.emptyAction} onClick={() => navigate('/workzone/chapan/orders/new')}>+ Создать заказ</button>
          )}
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <div key={viewMode} className={styles.viewContent}>
          {viewMode === 'grid' ? (
            <div className={styles.grid}>
              {displayGroups.map((g, i) =>
                g.kind === 'single'
                  ? <OrderCard key={g.order.id} order={g.order} onClick={() => setSelectedOrderId(g.order.id)} hasAlert={activeAlertOrderIds.has(g.order.id)} stockMap={stockMap} />
                  : <BatchCard key={`batch-${i}`} group={g} onSelectOrder={setSelectedOrderId} />
              )}
            </div>
          ) : (
            <div className={styles.list}>
              {displayGroups.map((g, i) =>
                g.kind === 'single'
                  ? <OrderRow key={g.order.id} order={g.order} onClick={() => setSelectedOrderId(g.order.id)} hasAlert={activeAlertOrderIds.has(g.order.id)} stockMap={stockMap} />
                  : <BatchRow key={`batch-${i}`} group={g} onSelectOrder={setSelectedOrderId} />
              )}
            </div>
          )}
        </div>
      )}

      {selectedOrderId && <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} navigate={navigate} />}

      {/* Alerts panel */}
      {showAlertsPanel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0, 0, 0, 0.2)',
          }}
          onClick={() => setShowAlertsPanel(false)}
        >
          <div
            style={{
              position: 'fixed',
              top: '70px',
              right: '20px',
              width: '360px',
              maxHeight: '500px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
              overflow: 'auto',
              zIndex: 41,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Неоплаченные заказы</span>
                <button
                  onClick={() => setShowAlertsPanel(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ padding: '12px' }}>
              {alerts.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  Нет активных алертов
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      background: 'rgba(217, 79, 79, 0.08)',
                      border: '1px solid rgba(217, 79, 79, 0.25)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedOrderId(alert.orderId);
                      setShowAlertsPanel(false);
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                      {alert.orderNumber}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {alert.order.clientName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#D94F4F', fontWeight: 500 }}>
                      Остаток: {(alert.order.totalAmount - alert.order.paidAmount).toLocaleString('ru-KZ')} ₸
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single grid card ──────────────────────────────────────────────────────────

function OrderCard({ order, onClick, hasAlert, stockMap }: { order: ChapanOrder; onClick: () => void; hasAlert?: boolean; stockMap?: ProductsAvailabilityMap }) {
  const overdue = isOverdue(order.dueDate);
  const first = order.items?.[0];
  const more = (order.items?.length ?? 0) - 1;
  const showStock = (order.status === 'new' || order.status === 'confirmed') && !!first?.productName && !!stockMap;
  const stockInfo = showStock ? stockMap![first!.productName] : undefined;

  return (
    <button
      className={`${styles.card} ${hasAlert ? styles.cardAlert : ''}`}
      style={{ '--status-color': STATUS_COLOR[order.status] } as React.CSSProperties}
      onClick={onClick}
    >
      <div className={styles.cardHead}>
        <span className={styles.cardNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
        {order.priority !== 'normal' && (
          <span className={`${styles.priorityBadge} ${order.priority === 'vip' ? styles.vip : styles.urgent}`}>
            {PRIORITY_LABEL[order.priority]}
          </span>
        )}
        {stockInfo !== undefined && (
          <span className={stockInfo.available ? styles.stockPillIn : styles.stockPillOut}>
            {stockInfo.available ? `склад: ${stockInfo.qty} шт.` : 'нет на складе'}
          </span>
        )}
      </div>
      <div className={styles.cardClient}>{order.clientName}</div>
      <span className={styles.cardPhone}>{order.clientPhone}</span>
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
            {fmtDate(order.dueDate)}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Batch grid card ───────────────────────────────────────────────────────────

function BatchCard({ group, onSelectOrder }: { group: { orders: ChapanOrder[] }; onSelectOrder: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { orders } = group;
  const first = orders[0];
  const item = first.items?.[0];
  const totalQty = orders.reduce((s, o) => s + (o.items?.[0]?.quantity ?? 1), 0);

  const dated = orders.filter(o => o.dueDate).sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
  const minDate = dated[0]?.dueDate ?? null;
  const maxDate = dated[dated.length - 1]?.dueDate ?? null;
  const anyOverdue = orders.some(o => isOverdue(o.dueDate));
  const depth = orders.length >= 3 ? 2 : 1;

  return (
    <div
      className={[
        styles.batchOuter,
        depth >= 2 ? styles.batchOuter3 : '',
        expanded ? styles.batchOuterExpanded : '',
      ].join(' ')}
      style={{ '--status-color': STATUS_COLOR[first.status] } as React.CSSProperties}
    >
      <button
        className={`${styles.batchCard} ${expanded ? styles.batchCardOpen : ''}`}
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <div className={styles.batchHead}>
          <span className={styles.batchCountBadge}>{orders.length}</span>
          <span className={styles.batchLabel}>заказа</span>
          <span className={styles.statusBadge}>{STATUS_LABEL[first.status]}</span>
          {first.priority !== 'normal' && (
            <span className={`${styles.priorityBadge} ${first.priority === 'vip' ? styles.vip : styles.urgent}`}>
              {PRIORITY_LABEL[first.priority]}
            </span>
          )}
          <span className={`${styles.batchChevron} ${expanded ? styles.batchChevronOpen : ''}`}>›</span>
        </div>

        {item && (
          <div className={styles.batchProduct}>
            <span className={styles.batchProductName}>{item.productName}</span>
            {(item.fabric || item.size) && (
              <span className={styles.cardItemMeta}>{[item.fabric, item.size].filter(Boolean).join(' · ')}</span>
            )}
          </div>
        )}

        <div className={styles.batchStats}>
          <span className={styles.batchQtyTag}>{totalQty} шт. итого</span>
          {minDate && (
            <span
              className={styles.batchDateRange}
              style={{ color: anyOverdue ? '#EF4444' : '#6B7280' }}
            >
              {fmtDate(minDate)}
              {maxDate && maxDate !== minDate ? ` — ${fmtDate(maxDate)}` : ''}
            </span>
          )}
        </div>

        <div className={styles.batchAvatarRow}>
          {orders.slice(0, 6).map(o => (
            <span key={o.id} className={styles.batchAvatar} title={o.clientName}>
              {o.clientName[0]?.toUpperCase() ?? '?'}
            </span>
          ))}
          {orders.length > 6 && <span className={styles.batchAvatarPlus}>+{orders.length - 6}</span>}
        </div>
      </button>

      {expanded && (
        <div
          className={styles.batchExpandList}
          style={{ '--status-color': STATUS_COLOR[first.status] } as React.CSSProperties}
        >
          {orders.map((o, i) => {
            const overdue = isOverdue(o.dueDate);
            return (
              <button
                key={o.id}
                className={styles.batchMiniCard}
                style={{ '--status-color': STATUS_COLOR[o.status], '--delay': `${i * 40}ms` } as React.CSSProperties}
                onClick={e => { e.stopPropagation(); onSelectOrder(o.id); }}
              >
                <span className={styles.batchMiniStripe} />
                <div className={styles.batchMiniContent}>
                  <div className={styles.batchMiniTop}>
                    <span className={styles.cardNum}>#{o.orderNumber}</span>
                    <span className={styles.batchMiniClient}>{o.clientName}</span>
                    {o.priority !== 'normal' && (
                      <span className={`${styles.priorityBadge} ${o.priority === 'vip' ? styles.vip : styles.urgent}`} style={{ fontSize: '9px' }}>
                        {PRIORITY_LABEL[o.priority]}
                      </span>
                    )}
                  </div>
                  <div className={styles.batchMiniBot}>
                    <span className={styles.cardItemMeta}>{o.items?.[0]?.quantity ?? 1} шт.</span>
                    <span className={styles.cardAmount}>{fmt(o.totalAmount)}</span>
                    <span className={styles.cardPay} style={{ color: PAY_COLOR[o.paymentStatus] }}>{PAY_LABEL[o.paymentStatus]}</span>
                    {o.dueDate && (
                      <span className={styles.cardDate} style={{ color: overdue ? '#EF4444' : '#6B7280', marginLeft: 'auto' }}>
                        {overdue ? '⚠ ' : ''}{fmtDate(o.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Single list row ───────────────────────────────────────────────────────────

function OrderRow({ order, onClick, hasAlert, stockMap }: { order: ChapanOrder; onClick: () => void; hasAlert?: boolean; stockMap?: ProductsAvailabilityMap }) {
  const overdue = isOverdue(order.dueDate);
  const first = order.items?.[0];
  const more = (order.items?.length ?? 0) - 1;
  const showStock = (order.status === 'new' || order.status === 'confirmed') && !!first?.productName && !!stockMap;
  const stockInfo = showStock ? stockMap![first!.productName] : undefined;

  return (
    <button
      className={`${styles.row} ${hasAlert ? styles.rowAlert : ''}`}
      style={{ '--status-color': STATUS_COLOR[order.status] } as React.CSSProperties}
      onClick={onClick}
    >
      <span className={styles.rowStripe} />
      <div className={styles.rowNum}>
        <span className={styles.cardNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
        {order.priority !== 'normal' && (
          <span className={`${styles.priorityBadge} ${order.priority === 'vip' ? styles.vip : styles.urgent}`}>
            {PRIORITY_LABEL[order.priority]}
          </span>
        )}
        {stockInfo !== undefined && (
          <span className={stockInfo.available ? styles.stockPillIn : styles.stockPillOut}>
            {stockInfo.available ? `склад: ${stockInfo.qty} шт.` : 'нет на складе'}
          </span>
        )}
      </div>
      <div className={styles.rowClient}>
        <span className={styles.cardClient}>{order.clientName}</span>
        <span className={styles.cardPhone}>{order.clientPhone}</span>
      </div>
      <div className={styles.rowProduct}>
        {first ? (
          <>
            <span className={styles.cardItemName}>{first.productName}</span>
            {(first.fabric || first.size) && (
              <span className={styles.cardItemMeta}>
                {[first.fabric, first.size].filter(Boolean).join(' · ')}
                {first.quantity > 1 && ` × ${first.quantity}`}
              </span>
            )}
            {more > 0 && <span className={styles.cardMoreItems}>+ещё {more}</span>}
          </>
        ) : (
          <span className={styles.cardItemMeta}>—</span>
        )}
      </div>
      <div className={styles.rowFin}>
        <span className={styles.cardAmount}>{fmt(order.totalAmount)}</span>
        <span className={styles.cardPay} style={{ color: PAY_COLOR[order.paymentStatus] }}>
          {PAY_LABEL[order.paymentStatus]}
        </span>
      </div>
      <div className={styles.rowDate}>
        {order.dueDate
          ? <span style={{ color: overdue ? '#EF4444' : '#6B7280' }}>{fmtDate(order.dueDate)}</span>
          : <span className={styles.rowDateEmpty}>—</span>
        }
      </div>
    </button>
  );
}

// ── Batch list row ────────────────────────────────────────────────────────────

function BatchRow({ group, onSelectOrder }: { group: { orders: ChapanOrder[] }; onSelectOrder: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { orders } = group;
  const first = orders[0];
  const item = first.items?.[0];
  const totalQty = orders.reduce((s, o) => s + (o.items?.[0]?.quantity ?? 1), 0);

  const dated = orders.filter(o => o.dueDate).sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
  const minDate = dated[0]?.dueDate ?? null;
  const maxDate = dated[dated.length - 1]?.dueDate ?? null;
  const anyOverdue = orders.some(o => isOverdue(o.dueDate));

  return (
    <div className={styles.batchRowOuter}>
      <button
        className={`${styles.row} ${styles.batchRow} ${expanded ? styles.batchRowOpen : ''}`}
        style={{ '--status-color': STATUS_COLOR[first.status] } as React.CSSProperties}
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.rowStripe} />
        <div className={styles.rowNum}>
          <span className={styles.batchCountBadge}>{orders.length}</span>
          <span className={styles.statusBadge}>{STATUS_LABEL[first.status]}</span>
          {first.priority !== 'normal' && (
            <span className={`${styles.priorityBadge} ${first.priority === 'vip' ? styles.vip : styles.urgent}`}>
              {PRIORITY_LABEL[first.priority]}
            </span>
          )}
        </div>
        <div className={styles.rowClient}>
          <div className={styles.batchAvatarRow}>
            {orders.slice(0, 5).map(o => (
              <span key={o.id} className={styles.batchAvatar} title={o.clientName}>
                {o.clientName[0]?.toUpperCase() ?? '?'}
              </span>
            ))}
            {orders.length > 5 && <span className={styles.batchAvatarPlus}>+{orders.length - 5}</span>}
          </div>
        </div>
        <div className={styles.rowProduct}>
          {item ? (
            <>
              <span className={styles.cardItemName}>{item.productName}</span>
              {(item.fabric || item.size) && (
                <span className={styles.cardItemMeta}>{[item.fabric, item.size].filter(Boolean).join(' · ')}</span>
              )}
            </>
          ) : <span className={styles.cardItemMeta}>—</span>}
        </div>
        <div className={styles.rowFin}>
          <span className={styles.batchQtyTag}>{totalQty} шт.</span>
        </div>
        <div className={styles.rowDate}>
          {minDate
            ? <span style={{ color: anyOverdue ? '#EF4444' : '#6B7280' }}>
                {fmtDate(minDate)}
                {maxDate && maxDate !== minDate ? `–${fmtDate(maxDate)}` : ''}
              </span>
            : <span className={styles.rowDateEmpty}>—</span>
          }
          <span className={`${styles.batchChevron} ${expanded ? styles.batchChevronOpen : ''}`}>›</span>
        </div>
      </button>

      {expanded && (
        <div className={styles.batchRowExpanded}>
          {orders.map(o => (
            <OrderRow key={o.id} order={o} onClick={() => onSelectOrder(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
