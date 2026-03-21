import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/shared/ui/IconButton';
import { useChapanStore } from '../../model/chapan.store';
import { useTileChapanUI } from '../../model/tile-ui.store';
import { OrderCard } from './OrderCard';
import type { Order, OrderStatus, UITone } from '../../api/types';
import { ORDER_STATUS_LABEL, ORDER_STATUS_ORDER, ORDER_STATUS_TONE } from '../../api/types';
import { useHorizontalBoardNav } from '../shared/useHorizontalBoardNav';
import s from './OrderList.module.css';

interface Props {
  tileId: string;
}

const TONE_CLASS: Record<UITone, string> = {
  muted: s.toneMuted,
  info: s.toneInfo,
  warning: s.toneWarning,
  danger: s.toneDanger,
  success: s.toneSuccess,
  accent: s.toneAccent,
};

export function OrderList({ tileId }: Props) {
  const { orders } = useChapanStore();
  const {
    filterStatus, filterPriority, filterPayment,
    searchQuery, sortBy, openDrawer,
  } = useTileChapanUI(tileId);

  const filtered = useMemo(() => {
    let list = [...orders];

    if (filterStatus === 'all') {
      list = list.filter((order) => order.status !== 'cancelled');
    }

    if (filterStatus !== 'all') {
      list = list.filter((order) => order.status === filterStatus);
    }
    if (filterPriority !== 'all') {
      list = list.filter((order) => order.priority === filterPriority);
    }
    if (filterPayment !== 'all') {
      list = list.filter((order) => order.paymentStatus === filterPayment);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter((order) =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.clientName.toLowerCase().includes(query) ||
        order.items.some((item) => item.productName.toLowerCase().includes(query)),
      );
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          return (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9');
        case 'totalAmount':
          return b.totalAmount - a.totalAmount;
        case 'updatedAt':
          return b.updatedAt.localeCompare(a.updatedAt);
        case 'createdAt':
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });

    return list;
  }, [orders, filterStatus, filterPriority, filterPayment, searchQuery, sortBy]);

  const columns = useMemo(() => {
    const visibleStatuses: OrderStatus[] =
      filterStatus === 'all'
        ? ORDER_STATUS_ORDER
        : [filterStatus];

    const grouped = Object.fromEntries(
      visibleStatuses.map((status) => [status, [] as Order[]]),
    ) as Record<OrderStatus, Order[]>;

    filtered.forEach((order) => {
      if (!grouped[order.status]) {
        grouped[order.status] = [];
      }
      grouped[order.status].push(order);
    });

    return visibleStatuses.map((status) => ({
      status,
      label: ORDER_STATUS_LABEL[status],
      tone: ORDER_STATUS_TONE[status],
      orders: grouped[status] ?? [],
    }));
  }, [filterStatus, filtered]);

  const {
    viewportRef,
    canScrollLeft,
    canScrollRight,
    scrollLeft,
    scrollRight,
    handleViewportKeyDown,
  } = useHorizontalBoardNav({
    deps: [columns.length, filtered.length],
    step: 360,
  });

  if (filtered.length === 0) {
    return (
      <div className={s.empty}>
        <div className={s.emptyTitle}>Нет заказов</div>
        <div className={s.emptySub}>
          {searchQuery ? 'Попробуйте изменить фильтры или запрос' : 'Создайте первый заказ'}
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <div className={s.toolbarText}>
          <span className={s.toolbarTitle}>Статусная доска заказов</span>
          <span className={s.toolbarHint}>Прокрутка стрелками или клавишами ← →</span>
        </div>

        <div className={s.toolbarActions}>
          <IconButton
            icon={<ChevronLeft size={16} />}
            label="Прокрутить заказы влево"
            variant="ghost"
            disabled={!canScrollLeft}
            onClick={scrollLeft}
            className={s.scrollBtn}
          />
          <IconButton
            icon={<ChevronRight size={16} />}
            label="Прокрутить заказы вправо"
            variant="ghost"
            disabled={!canScrollRight}
            onClick={scrollRight}
            className={s.scrollBtn}
          />
        </div>
      </div>

      <div
        ref={viewportRef}
        className={s.viewport}
        tabIndex={0}
        onKeyDown={handleViewportKeyDown}
        aria-label="Канбан заказов"
      >
        <div className={s.board}>
          {columns.map((column) => (
            <section key={column.status} className={s.column}>
              <div className={s.columnHeader}>
                <span className={`${s.columnDot} ${TONE_CLASS[column.tone]}`} />
                <span className={s.columnTitle}>{column.label}</span>
                <span className={s.columnCount}>{column.orders.length}</span>
              </div>

              <div className={s.columnBody}>
                {column.orders.length > 0 ? (
                  column.orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => openDrawer(order.id)}
                    />
                  ))
                ) : (
                  <div className={s.columnEmpty}>В этой колонке пока пусто</div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
