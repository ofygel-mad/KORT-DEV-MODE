import { useDeferredValue, useEffect, useRef, useState, type CSSProperties, type ElementType } from 'react';
import { AlertTriangle, Bell, Check, CheckCheck, CheckCircle2, CheckSquare, Download, FileText, LayoutGrid, Layers, List, Plus, Search, Warehouse, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChangeOrderStatus, useCloseOrder, useCreateInvoice, useInvoices, useOrders } from '../../../../entities/order/queries';
import type { ChapanInvoice, ChapanOrder, OrderStatus, Priority } from '../../../../entities/order/types';
import { useAuthStore } from '@/shared/stores/auth';
import { useCreateUnpaidAlert } from '../../../../entities/alert/queries';
import styles from './ChapanReady.module.css';

type ReadyStatus = Extract<OrderStatus, 'ready'>;
type ViewMode = 'grid' | 'list';
type ReadyOrder = ChapanOrder & { status: ReadyStatus };
type DisplayGroup =
  | { kind: 'single'; order: ReadyOrder }
  | { kind: 'batch'; orders: ReadyOrder[] };

const STATUS_LABEL: Record<ReadyStatus, string> = {
  ready: 'Готово',
};

const STATUS_COLOR: Record<ReadyStatus, string> = {
  ready: '#4FC999',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  normal: '',
  urgent: 'Срочно',
  vip: 'VIP',
};

const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен',
  partial: 'Частично',
  paid: 'Оплачен',
};
const PAY_COLOR: Record<string, string> = {
  not_paid: '#D94F4F',
  partial: '#E5922A',
  paid: '#4FC999',
};

const VIEW_OPTIONS: { key: ViewMode; label: string; icon: ElementType }[] = [
  { key: 'grid', label: 'Плитки', icon: LayoutGrid },
  { key: 'list', label: 'Список', icon: List },
];

const BATCH_WINDOW_DAYS = 2;

const INVOICE_STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Ожидает',
  confirmed: 'Подтверждена',
  rejected: 'Отклонена',
};

function invoiceStatusStyle(status: string): CSSProperties {
  if (status === 'confirmed') return { background: 'rgba(79,201,153,.12)', color: '#4FC999', border: '1px solid rgba(79,201,153,.25)' };
  if (status === 'rejected') return { background: 'rgba(217,79,79,.12)', color: '#E87272', border: '1px solid rgba(217,79,79,.25)' };
  return { background: 'rgba(229,146,42,.12)', color: '#E5922A', border: '1px solid rgba(229,146,42,.25)' };
}

function viewStorageKey(userId?: string) {
  return `chapan_ready_view_${userId ?? 'guest'}`;
}

function groupStorageKey(userId?: string) {
  return `chapan_ready_grouped_${userId ?? 'guest'}`;
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(value)} ₸`;
}

function formatDate(value: string | null) {
  if (!value) return 'Без даты';
  return new Date(value).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' });
}

function getOrderBalance(order: Pick<ChapanOrder, 'totalAmount' | 'paidAmount'>) {
  return Math.max(0, order.totalAmount - order.paidAmount);
}

function isOverdue(date: string | null) {
  return !!date && new Date(date) < new Date();
}

function groupSignature(order: ChapanOrder) {
  const firstItem = order.items?.[0];
  return [
    firstItem?.productName?.toLowerCase().trim() ?? '',
    firstItem?.fabric?.toLowerCase().trim() ?? '',
    firstItem?.size?.toLowerCase().trim() ?? '',
    order.status,
    order.priority,
  ].join('|');
}

function buildGroups(orders: ReadyOrder[]): DisplayGroup[] {
  const buckets = new Map<string, ReadyOrder[]>();

  for (const order of orders) {
    const key = groupSignature(order);
    buckets.set(key, [...(buckets.get(key) ?? []), order]);
  }

  const result: DisplayGroup[] = [];

  for (const [, bucket] of buckets) {
    if (bucket.length === 1) {
      result.push({ kind: 'single', order: bucket[0] });
      continue;
    }

    const withDate = bucket
      .filter((order) => order.dueDate)
      .sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
    const withoutDate = bucket.filter((order) => !order.dueDate);
    const clusters: ReadyOrder[][] = [];
    let current: ReadyOrder[] = [];

    for (const order of withDate) {
      if (!current.length) {
        current.push(order);
        continue;
      }

      const diffDays = (+new Date(order.dueDate!) - +new Date(current[0].dueDate!)) / 86_400_000;
      if (diffDays <= BATCH_WINDOW_DAYS) current.push(order);
      else {
        clusters.push(current);
        current = [order];
      }
    }

    if (current.length) clusters.push(current);
    if (withoutDate.length) clusters.push(withoutDate);

    for (const cluster of clusters) {
      if (cluster.length === 1) result.push({ kind: 'single', order: cluster[0] });
      else result.push({ kind: 'batch', orders: cluster });
    }
  }

  return result;
}

function getStageActionLabel(_status: ReadyStatus) {
  return 'На склад';
}

function getNextStage(_status: ReadyStatus): string | null {
  return 'on_warehouse';
}

export default function ChapanReadyPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReadyStatus | ''>('');
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [grouped, setGroupedState] = useState(true);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [closeUnpaidTarget, setCloseUnpaidTarget] = useState<{ ids: string[]; labels: string[]; balance: number } | null>(null);
  const [transferBlockedOrders, setTransferBlockedOrders] = useState<string[] | null>(null);
  const [invoicePanelOpen, setInvoicePanelOpen] = useState(false);
  const viewPickerRef = useRef<HTMLDivElement>(null);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const savedView = localStorage.getItem(viewStorageKey(userId));
    if (savedView === 'grid' || savedView === 'list') {
      setViewModeState(savedView);
    }

    const savedGroup = localStorage.getItem(groupStorageKey(userId));
    if (savedGroup !== null) {
      setGroupedState(savedGroup !== 'false');
    }
  }, [userId]);

  useEffect(() => {
    if (!showViewMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!viewPickerRef.current?.contains(event.target as Node)) {
        setShowViewMenu(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showViewMenu]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    setShowViewMenu(false);
    localStorage.setItem(viewStorageKey(userId), mode);
  };

  const toggleGrouped = () => {
    setGroupedState((value) => {
      localStorage.setItem(groupStorageKey(userId), String(!value));
      return !value;
    });
  };

  const requestedStatuses = statusFilter ? statusFilter : 'ready';
  const { data, isLoading, isError } = useOrders({
    archived: false,
    statuses: requestedStatuses,
    search: deferredSearch || undefined,
    limit: 200,
  });

  const changeStatus = useChangeOrderStatus();
  const closeOrder = useCloseOrder();
  const notifyManager = useCreateUnpaidAlert();
  const createInvoice = useCreateInvoice();
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ limit: 50 });
  const invoices: ChapanInvoice[] = invoicesData?.results ?? [];

  const orders = (data?.results ?? []).filter((order): order is ReadyOrder => (
    order.status === 'ready'
  ));

  const displayGroups = grouped
    ? buildGroups(orders)
    : orders.map((order) => ({ kind: 'single' as const, order }));

  function getUnpaidTransferLabels(targetOrders: ReadyOrder[]) {
    return targetOrders
      .filter((order) => order.paymentStatus !== 'paid')
      .map((order) => `#${order.orderNumber} — остаток: ${formatMoney(getOrderBalance(order))}`);
  }

  async function advancePaidOrders(targetOrders: ReadyOrder[]) {
    for (const order of targetOrders) {
      const nextStatus = getNextStage(order.status);
      if (nextStatus) {
        await changeStatus.mutateAsync({ id: order.id, status: nextStatus });
      }
    }
  }

  function requestAdvanceOrders(targetOrders: ReadyOrder[]) {
    const unpaidLabels = getUnpaidTransferLabels(targetOrders);
    if (unpaidLabels.length > 0) {
      setTransferBlockedOrders(unpaidLabels);
      return;
    }

    void advancePaidOrders(targetOrders);
  }

  function handleAdvance(order: ReadyOrder) {
    requestAdvanceOrders([order]);
  }

  function requestClose(order: ReadyOrder) {
    if (order.paymentStatus !== 'paid') {
      setCloseUnpaidTarget({
        ids: [order.id],
        labels: [`#${order.orderNumber} — остаток: ${formatMoney(getOrderBalance(order))}`],
        balance: getOrderBalance(order),
      });
    } else {
      void closeOrder.mutateAsync(order.id);
    }
  }

  function handleAdvanceMany(batchOrders: ReadyOrder[]) {
    requestAdvanceOrders(batchOrders);
  }

  function requestCloseMany(batchOrders: ReadyOrder[]) {
    const unpaid = batchOrders.filter((o) => o.paymentStatus !== 'paid');
    if (unpaid.length > 0) {
      setCloseUnpaidTarget({
        ids: batchOrders.map((o) => o.id),
        labels: unpaid.map((o) => `#${o.orderNumber} — остаток: ${formatMoney(getOrderBalance(o))}`),
        balance: unpaid.reduce((sum, o) => sum + getOrderBalance(o), 0),
      });
    } else {
      for (const order of batchOrders) {
        void closeOrder.mutateAsync(order.id);
      }
    }
  }

  async function forceCloseUnpaid() {
    if (!closeUnpaidTarget) return;
    for (const id of closeUnpaidTarget.ids) {
      await closeOrder.mutateAsync(id);
    }
    setCloseUnpaidTarget(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectMany(ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const hasUnpaidSelected = selectedOrders.some((o) => o.paymentStatus !== 'paid');
  const unpaidSelectedOrders = selectedOrders.filter((o) => o.paymentStatus !== 'paid');

  function handleTransferToWarehouse() {
    if (hasUnpaidSelected) {
      setTransferBlockedOrders(
        unpaidSelectedOrders.map((o) => `#${o.orderNumber} — остаток: ${formatMoney(getOrderBalance(o))}`)
      );
      return;
    }
    createInvoice.mutate(
      { orderIds: [...selectedIds] },
      { onSuccess: () => exitSelectMode() },
    );
  }

  async function handleBatchInvoiceDownload() {
    const { apiClient } = await import('../../../../shared/api/client');
    try {
      const response = await apiClient.post('/chapan/orders/batch-invoice', {
        orderIds: [...selectedIds],
        style: 'branded',
      }, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nakladnaya-batch-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    }
  }

  const currentView = VIEW_OPTIONS.find((option) => option.key === viewMode)!;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <CheckCheck size={18} />
          <span>Готовые заказы</span>
        </div>
        <div className={styles.headerSub}>Формирование накладных и передача на склад</div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Номер, клиент, изделие..."
          />
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.viewPickerWrap} ref={viewPickerRef}>
            <button
              className={`${styles.viewBtn} ${showViewMenu ? styles.viewBtnOpen : ''}`}
              onClick={() => setShowViewMenu((value) => !value)}
            >
              <currentView.icon size={13} />
              <span>Вид</span>
            </button>

            {showViewMenu && (
              <div className={styles.viewMenu}>
                <div className={styles.viewMenuTitle}>Отображение</div>
                {VIEW_OPTIONS.map(({ key, label, icon: Icon }) => (
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

          <button
            className={`${styles.groupToggle} ${grouped ? styles.groupToggleActive : ''}`}
            onClick={toggleGrouped}
          >
            <Layers size={13} />
            <span>Группировать</span>
          </button>

          <button
            className={`${styles.groupToggle} ${selectMode ? styles.selectToggleActive : ''}`}
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          >
            <CheckSquare size={13} />
            <span>Отметить</span>
          </button>

          <button
            className={`${styles.groupToggle} ${invoicePanelOpen ? styles.groupToggleActive : ''}`}
            onClick={() => setInvoicePanelOpen((v) => !v)}
          >
            <FileText size={13} />
            <span>Накладные</span>
          </button>
        </div>
      </div>

      {!isLoading && (
        <div className={styles.count}>
          {data?.count ?? 0} заказов в работе после пошива
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={styles.skeleton} />
          ))}
        </div>
      )}

      {isError && <div className={styles.error}>Не удалось загрузить раздел «Готово»</div>}

      {!isLoading && !isError && orders.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Пока пусто</div>
          <div className={styles.emptyText}>
            Как только швея завершит карточку, заказ появится здесь.
          </div>
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        viewMode === 'grid' ? (
          <div className={styles.grid}>
            {displayGroups.map((group, index) => (
              group.kind === 'single' ? (
                <ReadyCard
                  key={group.order.id}
                  order={group.order}
                  onOpen={() => navigate(`/workzone/chapan/orders/${group.order.id}`)}
                  onAdvance={() => handleAdvance(group.order)}
                  onClose={() => requestClose(group.order)}
                  selectMode={selectMode}
                  isSelected={selectedIds.has(group.order.id)}
                  onToggleSelect={() => toggleSelect(group.order.id)}
                />
              ) : (
                <ReadyBatchCard
                  key={`batch-${index}`}
                  orders={group.orders}
                  onOpen={(id) => navigate(`/workzone/chapan/orders/${id}`)}
                  onAdvance={() => handleAdvanceMany(group.orders)}
                  onClose={() => requestCloseMany(group.orders)}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelectMany={() => toggleSelectMany(group.orders.map((o) => o.id))}
                />
              )
            ))}
          </div>
        ) : (
          <div className={styles.list}>
            {displayGroups.map((group, index) => (
              group.kind === 'single' ? (
                <ReadyRow
                  key={group.order.id}
                  order={group.order}
                  onOpen={() => navigate(`/workzone/chapan/orders/${group.order.id}`)}
                  onAdvance={() => handleAdvance(group.order)}
                  onClose={() => requestClose(group.order)}
                  selectMode={selectMode}
                  isSelected={selectedIds.has(group.order.id)}
                  onToggleSelect={() => toggleSelect(group.order.id)}
                />
              ) : (
                <ReadyBatchRow
                  key={`batch-row-${index}`}
                  orders={group.orders}
                  onOpen={(id) => navigate(`/workzone/chapan/orders/${id}`)}
                  onAdvance={() => handleAdvanceMany(group.orders)}
                  onClose={() => requestCloseMany(group.orders)}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelectMany={() => toggleSelectMany(group.orders.map((o) => o.id))}
                />
              )
            ))}
          </div>
        )
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className={styles.floatingBar}>
          <div className={styles.floatingLeft}>
            <span className={styles.floatingCount}>{selectedIds.size} выбрано</span>
            <button className={styles.floatingClear} onClick={exitSelectMode}>
              <X size={12} />
              Снять
            </button>
          </div>
          <div className={styles.floatingRight}>
            <button className={styles.floatingAction} onClick={handleBatchInvoiceDownload}>
              <Download size={13} />
              Накладная
            </button>
            <button
              className={`${styles.floatingAction} ${styles.floatingActionPrimary}`}
              onClick={handleTransferToWarehouse}
              disabled={createInvoice.isPending}
            >
              <Warehouse size={13} />
              {createInvoice.isPending ? 'Создание...' : `На склад (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {transferBlockedOrders && (
        <div className={styles.confirmOverlay} onClick={() => setTransferBlockedOrders(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>
              <AlertTriangle size={16} />
              Заказ не полностью оплачен
            </div>
            <div className={styles.confirmText}>
              Передача на склад невозможна, пока остаток не внесён полностью:
              {transferBlockedOrders.map((label) => (
                <div key={label} className={styles.unpaidLine}>{label}</div>
              ))}
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmSecondary} onClick={() => setTransferBlockedOrders(null)}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {closeUnpaidTarget && (
        <div className={styles.confirmOverlay} onClick={() => setCloseUnpaidTarget(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>
              <AlertTriangle size={16} />
              Заказ не полностью оплачен
            </div>
            <div className={styles.confirmText}>
              <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Передача на склад невозможна, пока остаток не внесён полностью:
              </div>
              {closeUnpaidTarget.labels.map((label) => (
                <div key={label} className={styles.unpaidLine}>{label}</div>
              ))}
            </div>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmSecondary}
                onClick={() => setCloseUnpaidTarget(null)}
              >
                Понятно
              </button>
              <button
                className={styles.notifyBtn}
                onClick={async () => {
                  for (const id of closeUnpaidTarget.ids) {
                    const order = orders.find(o => o.id === id);
                    if (order) {
                      await notifyManager.mutateAsync({
                        orderId: id,
                        orderNumber: order.orderNumber,
                      });
                    }
                  }
                  setCloseUnpaidTarget(null);
                }}
                disabled={notifyManager.isPending}
              >
                {notifyManager.isPending ? 'Отправка...' : 'Оповестить менеджера'}
              </button>
            </div>
          </div>
        </div>
      )}

      {invoicePanelOpen && (
        <div className={styles.invoicePanelOverlay} onClick={() => setInvoicePanelOpen(false)}>
          <div className={styles.invoicePanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.invoicePanelHead}>
              <span className={styles.invoicePanelTitle}>Накладные</span>
              <button className={styles.invoicePanelClose} onClick={() => setInvoicePanelOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.invoicePanelBody}>
              {selectMode && selectedIds.size > 0 && (
                <div className={styles.invoiceSection}>
                  <span className={styles.invoiceSectionLabel}>Создать для выбранных</span>
                  <div className={styles.invoiceCreateBox}>
                    <span className={styles.invoiceCreateInfo}>
                      {hasUnpaidSelected
                        ? `Есть ${unpaidSelectedOrders.length} неоплаченных — передача на склад заблокирована`
                        : `${selectedIds.size} заказов будут переданы на склад через накладную`}
                    </span>
                    <button
                      className={styles.invoiceCreateBtn}
                      disabled={hasUnpaidSelected || createInvoice.isPending}
                      onClick={() => {
                        createInvoice.mutate(
                          { orderIds: [...selectedIds] },
                          { onSuccess: () => { exitSelectMode(); setInvoicePanelOpen(false); } },
                        );
                      }}
                    >
                      <Plus size={13} />
                      {createInvoice.isPending ? 'Создание...' : `Создать накладную (${selectedIds.size})`}
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.invoiceSection}>
                <span className={styles.invoiceSectionLabel}>История</span>
                {invoicesLoading ? (
                  <div className={styles.invoicePanelEmpty}>
                    <span className={styles.invoicePanelEmptyNote}>Загрузка...</span>
                  </div>
                ) : invoices.length === 0 ? (
                  <div className={styles.invoicePanelEmpty}>
                    <FileText size={28} style={{ opacity: 0.3 }} />
                    <span className={styles.invoicePanelEmptyText}>Накладных пока нет</span>
                    <span className={styles.invoicePanelEmptyNote}>Выберите заказы и создайте первую накладную</span>
                  </div>
                ) : (
                  invoices.map((inv) => (
                    <div key={inv.id} className={styles.invoiceRow}>
                      <div className={styles.invoiceRowHead}>
                        <span className={styles.invoiceRowNum}>#{inv.invoiceNumber}</span>
                        <span className={styles.invoiceStatusBadge} style={invoiceStatusStyle(inv.status)}>
                          {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                        <div className={styles.invoiceConfirmIcons}>
                          <span className={styles.invoiceConfirmIcon} style={inv.seamstressConfirmed ? { background: 'rgba(79,201,153,.12)', color: '#4FC999' } : { background: 'rgba(255,255,255,.04)', color: 'var(--ch-text-muted)' }}>
                            Швея
                          </span>
                          <span className={styles.invoiceConfirmIcon} style={inv.warehouseConfirmed ? { background: 'rgba(79,201,153,.12)', color: '#4FC999' } : { background: 'rgba(255,255,255,.04)', color: 'var(--ch-text-muted)' }}>
                            Склад
                          </span>
                        </div>
                      </div>
                      <div className={styles.invoiceRowMeta}>
                        <span>{inv.items?.length ?? 0} заказов</span>
                        <span>{formatDate(inv.createdAt)}</span>
                        <span>{inv.createdByName}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadyCard({
  order,
  onOpen,
  onAdvance,
  onClose,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  order: ReadyOrder;
  onOpen: () => void;
  onAdvance: () => void;
  onClose: () => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const firstItem = order.items?.[0];
  const moreItems = (order.items?.length ?? 0) - 1;
  const nextStageLabel = getStageActionLabel(order.status);

  const handleClick = selectMode && onToggleSelect ? onToggleSelect : onOpen;

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
      style={{ '--status-color': STATUS_COLOR[order.status] } as CSSProperties}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      {isSelected && <span className={styles.selectCheckmark}><Check size={14} /></span>}

      <div className={styles.cardHead}>
        <span className={styles.orderNumber}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
        {order.priority !== 'normal' && (
          <span className={styles.priorityBadge}>{PRIORITY_LABEL[order.priority]}</span>
        )}
      </div>

      <div className={styles.clientName}>{order.clientName}</div>
      <div className={styles.phone}>{order.clientPhone}</div>

      {firstItem && (
        <div className={styles.itemBlock}>
          <span className={styles.itemName}>{firstItem.productName}</span>
          <span className={styles.itemMeta}>
            {[firstItem.fabric, firstItem.size].filter(Boolean).join(' · ')}
            {firstItem.quantity > 1 && ` × ${firstItem.quantity}`}
          </span>
          {moreItems > 0 && <span className={styles.itemMore}>+ еще {moreItems}</span>}
        </div>
      )}

      <div className={styles.cardFoot}>
        <span className={styles.amount}>{formatMoney(order.totalAmount)}</span>
        <span className={styles.payBadge} style={{ color: PAY_COLOR[order.paymentStatus] }}>
          {PAY_LABEL[order.paymentStatus]}
        </span>
        <span className={styles.deadline} style={{ color: isOverdue(order.dueDate) ? '#D94F4F' : undefined }}>
          {formatDate(order.dueDate)}
        </span>
      </div>

      {!selectMode && (
        <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
          <button className={styles.primaryAction} onClick={onClose}>
            На склад
          </button>
        </div>
      )}
    </div>
  );
}

function ReadyBatchCard({
  orders,
  onOpen,
  onAdvance,
  onClose,
  selectMode,
  selectedIds,
  onToggleSelectMany,
}: {
  orders: ReadyOrder[];
  onOpen: (id: string) => void;
  onAdvance: () => void;
  onClose: () => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelectMany?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const firstOrder = orders[0];
  const firstItem = firstOrder.items?.[0];
  const totalQuantity = orders.reduce((sum, order) => sum + (order.items?.[0]?.quantity ?? 1), 0);
  const nextStageLabel = getStageActionLabel(firstOrder.status);
  const allSelected = selectedIds ? orders.every((o) => selectedIds.has(o.id)) : false;

  const handleSummaryClick = selectMode && onToggleSelectMany
    ? onToggleSelectMany
    : () => setExpanded((value) => !value);

  return (
    <div
      className={`${styles.batchCard} ${allSelected ? styles.cardSelected : ''}`}
      style={{ '--status-color': STATUS_COLOR[firstOrder.status] } as CSSProperties}
    >
      <button className={styles.batchSummary} onClick={handleSummaryClick}>
        <div className={styles.batchHead}>
          {allSelected && <Check size={14} className={styles.rowCheckmark} />}
          <span className={styles.batchCount}>{orders.length}</span>
          <span className={styles.statusBadge}>{STATUS_LABEL[firstOrder.status]}</span>
        </div>

        {firstItem && (
          <div className={styles.batchProduct}>
            <span className={styles.itemName}>{firstItem.productName}</span>
            <span className={styles.itemMeta}>{[firstItem.fabric, firstItem.size].filter(Boolean).join(' · ')}</span>
          </div>
        )}

        <div className={styles.batchMeta}>
          <span>{totalQuantity} шт.</span>
          <span>{formatDate(firstOrder.dueDate)}</span>
        </div>
      </button>

      {!selectMode && (
        <div className={styles.actions}>
          <button className={styles.primaryAction} onClick={onClose}>
            На склад ×{orders.length}
          </button>
        </div>
      )}

      {expanded && !selectMode && (
        <div className={styles.batchExpanded}>
          {orders.map((order) => (
            <button key={order.id} className={styles.batchItem} onClick={() => onOpen(order.id)}>
              <span>#{order.orderNumber}</span>
              <span>{order.clientName}</span>
              <span>{formatMoney(order.totalAmount)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadyRow({
  order,
  onOpen,
  onAdvance,
  onClose,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  order: ReadyOrder;
  onOpen: () => void;
  onAdvance: () => void;
  onClose: () => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const firstItem = order.items?.[0];
  const nextStageLabel = getStageActionLabel(order.status);

  const handleClick = selectMode && onToggleSelect ? onToggleSelect : onOpen;

  return (
    <div
      className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
      style={{ '--status-color': STATUS_COLOR[order.status] } as CSSProperties}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      <span className={styles.rowStripe} />
      <div className={styles.rowMain}>
        <div className={styles.rowTop}>
          {isSelected && <Check size={13} className={styles.rowCheckmark} />}
          <span className={styles.orderNumber}>#{order.orderNumber}</span>
          <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
          <span className={styles.payBadge} style={{ color: PAY_COLOR[order.paymentStatus] }}>
            {PAY_LABEL[order.paymentStatus]}
          </span>
        </div>
        <div className={styles.rowClient}>{order.clientName}</div>
        <div className={styles.rowMeta}>
          <span>{firstItem?.productName ?? 'Без позиции'}</span>
          <span>{formatMoney(order.totalAmount)}</span>
          <span>{formatDate(order.dueDate)}</span>
        </div>
      </div>

      {!selectMode && (
        <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
          <button className={styles.primaryAction} onClick={onClose}>
            На склад
          </button>
        </div>
      )}
    </div>
  );
}

function ReadyBatchRow({
  orders,
  onOpen,
  onAdvance,
  onClose,
  selectMode,
  selectedIds,
  onToggleSelectMany,
}: {
  orders: ReadyOrder[];
  onOpen: (id: string) => void;
  onAdvance: () => void;
  onClose: () => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelectMany?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const firstOrder = orders[0];
  const firstItem = firstOrder.items?.[0];
  const nextStageLabel = getStageActionLabel(firstOrder.status);
  const allSelected = selectedIds ? orders.every((o) => selectedIds.has(o.id)) : false;

  const handleClick = selectMode && onToggleSelectMany
    ? onToggleSelectMany
    : () => setExpanded((value) => !value);

  return (
    <div className={styles.batchRowWrap}>
      <div
        className={`${styles.row} ${allSelected ? styles.rowSelected : ''}`}
        style={{ '--status-color': STATUS_COLOR[firstOrder.status] } as CSSProperties}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
          }
        }}
      >
        <span className={styles.rowStripe} />
        <div className={styles.rowMain}>
          <div className={styles.rowTop}>
            {allSelected && <Check size={13} className={styles.rowCheckmark} />}
            <span className={styles.batchCount}>{orders.length}</span>
            <span className={styles.statusBadge}>{STATUS_LABEL[firstOrder.status]}</span>
          </div>
          <div className={styles.rowClient}>{firstItem?.productName ?? 'Без позиции'}</div>
          <div className={styles.rowMeta}>
            <span>{orders.length} заказов</span>
            <span>{formatDate(firstOrder.dueDate)}</span>
          </div>
        </div>

        {!selectMode && (
          <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
            <button className={styles.primaryAction} onClick={onClose}>
              На склад ×{orders.length}
            </button>
          </div>
        )}
      </div>

      {expanded && !selectMode && (
        <div className={styles.batchExpandedRows}>
          {orders.map((order) => (
            <button key={order.id} className={styles.batchItem} onClick={() => onOpen(order.id)}>
              <span>#{order.orderNumber}</span>
              <span>{order.clientName}</span>
              <span>{formatMoney(order.totalAmount)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
