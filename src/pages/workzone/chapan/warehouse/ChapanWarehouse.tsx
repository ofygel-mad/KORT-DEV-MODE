import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, Clock, PackageCheck, Send, Warehouse as WarehouseIcon, Package, Factory } from 'lucide-react';
import {
  useInvoices,
  useConfirmWarehouse,
  useOrders,
  useShipOrder,
} from '../../../../entities/order/queries';
import type { ChapanOrder, ChapanInvoice } from '../../../../entities/order/types';
import styles from './ChapanWarehouse.module.css';

type TabKey = 'incoming' | 'on_warehouse' | 'to_ship';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'incoming', label: 'Входящие' },
  { key: 'on_warehouse', label: 'На складе' },
  { key: 'to_ship', label: 'К отправке' },
];

const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен',
  partial: 'Частично',
  paid: 'Оплачен',
};

const PAY_COLOR: Record<string, string> = {
  not_paid: '#EF4444',
  partial: '#F59E0B',
  paid: '#10B981',
};

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ChapanWarehousePage() {
  const [tab, setTab] = useState<TabKey>('incoming');

  // Incoming: pending invoices where warehouse hasn't confirmed
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({
    status: 'pending_confirmation',
    limit: 200,
  });
  const pendingInvoices = (invoicesData?.results ?? []).filter((inv) => !inv.warehouseConfirmed);

  // On warehouse: orders with status 'on_warehouse'
  const { data: warehouseData, isLoading: warehouseLoading } = useOrders({
    status: 'on_warehouse',
    limit: 200,
  });
  const warehouseOrders: ChapanOrder[] = warehouseData?.results ?? [];

  // To ship: on_warehouse orders that are paid
  const toShipOrders = warehouseOrders.filter((o) => o.paymentStatus === 'paid');
  const unpaidOrders = warehouseOrders.filter((o) => o.paymentStatus !== 'paid');

  const isLoading = tab === 'incoming' ? invoicesLoading : warehouseLoading;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <WarehouseIcon size={18} />
          <span>Склад</span>
        </div>
        <div className={styles.headerSub}>Приёмка, хранение и отгрузка заказов</div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {TABS.map((t) => {
            let count = 0;
            if (t.key === 'incoming') count = pendingInvoices.length;
            else if (t.key === 'on_warehouse') count = warehouseOrders.length;
            else if (t.key === 'to_ship') count = toShipOrders.length;
            return (
              <button
                key={t.key}
                type="button"
                className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {count > 0 && <span className={styles.tabBadge}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className={styles.loading}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {!isLoading && tab === 'incoming' && (
        <IncomingTab invoices={pendingInvoices} />
      )}

      {!isLoading && tab === 'on_warehouse' && (
        <OnWarehouseTab orders={warehouseOrders} />
      )}

      {!isLoading && tab === 'to_ship' && (
        <ToShipTab paidOrders={toShipOrders} unpaidOrders={unpaidOrders} />
      )}
    </div>
  );
}

// ── Incoming Tab ─────────────────────────────────────────────────────────────

function IncomingTab({ invoices }: { invoices: ChapanInvoice[] }) {
  const confirmWarehouse = useConfirmWarehouse();

  if (invoices.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Package size={36} className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>Нет входящих накладных</div>
        <div className={styles.emptyText}>
          Когда контролёр передаст готовые заказы на склад, накладные появятся здесь
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.count}>{invoices.length} накладных ожидают подтверждения</div>
      <div className={styles.list}>
        {invoices.map((inv) => (
          <div key={inv.id} className={styles.invoiceRow}>
            <div className={styles.cell}>
              <span className={styles.cellMono}>#{inv.invoiceNumber}</span>
              <span className={styles.cellSub}>{fmtDate(inv.createdAt)}</span>
              <span className={styles.cellSub}>{inv.createdByName}</span>
            </div>

            <div className={`${styles.cell} ${styles.cellBorder}`}>
              <span className={styles.cellLabel}>
                {inv.items?.length ?? 0} {(inv.items?.length ?? 0) === 1 ? 'заказ' : (inv.items?.length ?? 0) < 5 ? 'заказа' : 'заказов'}
              </span>
            </div>

            <div className={`${styles.cell} ${styles.cellBorder}`}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span className={`${styles.confirmItem} ${inv.seamstressConfirmed ? styles.confirmDone : styles.confirmPending}`}>
                  {inv.seamstressConfirmed ? <Check size={12} /> : <Clock size={12} />}
                  Швея
                </span>
                <span className={`${styles.confirmItem} ${styles.confirmPending}`}>
                  <Clock size={12} />
                  Склад
                </span>
              </div>
            </div>

            <div className={`${styles.cell} ${styles.cellBorder}`}>
              <span
                className={styles.statusBadge}
                style={{ '--badge-color': '#F59E0B' } as React.CSSProperties}
              >
                Ожидает
              </span>
            </div>

            <div className={styles.cellActions}>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                onClick={() => confirmWarehouse.mutate(inv.id)}
                disabled={confirmWarehouse.isPending}
              >
                <PackageCheck size={13} />
                {confirmWarehouse.isPending ? 'Подтверждение...' : 'Принять'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── On Warehouse Tab ─────────────────────────────────────────────────────────

function OnWarehouseTab({ orders }: { orders: ChapanOrder[] }) {
  const navigate = useNavigate();

  if (orders.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Factory size={36} className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>Склад пуст</div>
        <div className={styles.emptyText}>
          Принятые заказы появятся здесь после подтверждения накладных
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.count}>{orders.length} заказов на складе</div>
      <div className={styles.list}>
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            onClick={() => navigate(`/workzone/chapan/orders/${order.id}`)}
            statusColor="#8B5CF6"
          />
        ))}
      </div>
    </>
  );
}

// ── To Ship Tab ──────────────────────────────────────────────────────────────

function ToShipTab({ paidOrders, unpaidOrders }: { paidOrders: ChapanOrder[]; unpaidOrders: ChapanOrder[] }) {
  const navigate = useNavigate();
  const shipOrder = useShipOrder();

  if (paidOrders.length === 0 && unpaidOrders.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Send size={36} className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>Нет заказов к отправке</div>
        <div className={styles.emptyText}>
          Оплаченные заказы со склада будут готовы к отгрузке
        </div>
      </div>
    );
  }

  return (
    <>
      {paidOrders.length > 0 && (
        <>
          <div className={styles.count}>{paidOrders.length} заказов готовы к отправке</div>
          <div className={styles.list}>
            {paidOrders.map((order) => (
              <div key={order.id} className={styles.orderRow}>
                <span className={styles.rowStripe} style={{ '--status-color': '#10B981' } as React.CSSProperties} />
                <div className={styles.cell}>
                  <span className={styles.cellMono}>#{order.orderNumber}</span>
                  <span className={styles.cellSub}>{fmtDate(order.createdAt)}</span>
                </div>
                <div className={`${styles.cell} ${styles.cellBorder}`}>
                  <span className={styles.cellLabel}>{order.clientName}</span>
                  <span className={styles.cellSub}>{order.clientPhone}</span>
                </div>
                <div className={`${styles.cell} ${styles.cellBorder}`}>
                  {order.items?.[0] && (
                    <>
                      <span className={styles.cellLabel}>{order.items[0].productName}</span>
                      <span className={styles.cellSub}>
                        {[order.items[0].size].filter(Boolean).join(' · ')}
                        {order.items[0].quantity > 1 && ` × ${order.items[0].quantity}`}
                        {(order.items.length - 1) > 0 && ` +ещё ${order.items.length - 1}`}
                      </span>
                    </>
                  )}
                </div>
                <div className={`${styles.cell} ${styles.cellBorder}`}>
                  <span className={styles.amount}>{fmt(order.totalAmount)}</span>
                  <span className={styles.payBadge} style={{ color: PAY_COLOR[order.paymentStatus] }}>
                    {PAY_LABEL[order.paymentStatus]}
                  </span>
                </div>
                <div className={styles.cellActions}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                    onClick={(e) => { e.stopPropagation(); shipOrder.mutate(order.id); }}
                    disabled={shipOrder.isPending}
                  >
                    <Send size={12} />
                    Отправить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {unpaidOrders.length > 0 && (
        <>
          <div className={styles.count} style={{ marginTop: paidOrders.length > 0 ? 16 : 0 }}>
            {unpaidOrders.length} неоплаченных заказов — отгрузка заблокирована
          </div>
          <div className={styles.list}>
            {unpaidOrders.map((order) => (
              <div
                key={order.id}
                className={styles.orderRow}
                onClick={() => navigate(`/workzone/chapan/orders/${order.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/workzone/chapan/orders/${order.id}`); }}
              >
                <span className={styles.rowStripe} style={{ '--status-color': '#EF4444' } as React.CSSProperties} />
                <div className={styles.cell}>
                  <span className={styles.cellMono}>#{order.orderNumber}</span>
                  <span className={styles.cellSub}>{fmtDate(order.createdAt)}</span>
                </div>
                <div className={`${styles.cell} ${styles.cellBorder}`}>
                  <span className={styles.cellLabel}>{order.clientName}</span>
                  <span className={styles.cellSub}>{order.clientPhone}</span>
                </div>
                <div className={`${styles.cell} ${styles.cellBorder}`}>
                  {order.items?.[0] && (
                    <>
                      <span className={styles.cellLabel}>{order.items[0].productName}</span>
                      <span className={styles.cellSub}>
                        {[order.items[0].size].filter(Boolean).join(' · ')}
                        {order.items[0].quantity > 1 && ` × ${order.items[0].quantity}`}
                        {(order.items.length - 1) > 0 && ` +ещё ${order.items.length - 1}`}
                      </span>
                    </>
                  )}
                </div>
                <div className={`${styles.cell} ${styles.cellBorder}`}>
                  <span className={styles.amount}>{fmt(order.totalAmount)}</span>
                  <span className={styles.payBadge} style={{ color: PAY_COLOR[order.paymentStatus] }}>
                    {PAY_LABEL[order.paymentStatus]}
                  </span>
                </div>
                <div className={styles.cellActions}>
                  <div className={styles.unpaidAlert}>
                    <AlertTriangle size={12} />
                    Не оплачен
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function OrderRow({ order, onClick, statusColor }: { order: ChapanOrder; onClick: () => void; statusColor: string }) {
  return (
    <div
      className={styles.orderRow}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <span className={styles.rowStripe} style={{ '--status-color': statusColor } as React.CSSProperties} />
      <div className={styles.cell}>
        <span className={styles.cellMono}>#{order.orderNumber}</span>
        <span className={styles.cellSub}>{fmtDate(order.createdAt)}</span>
      </div>
      <div className={`${styles.cell} ${styles.cellBorder}`}>
        <span className={styles.cellLabel}>{order.clientName}</span>
        <span className={styles.cellSub}>{order.clientPhone}</span>
      </div>
      <div className={`${styles.cell} ${styles.cellBorder}`}>
        {order.items?.[0] && (
          <>
            <span className={styles.cellLabel}>{order.items[0].productName}</span>
            <span className={styles.cellSub}>
              {[order.items[0].size].filter(Boolean).join(' · ')}
              {order.items[0].quantity > 1 && ` × ${order.items[0].quantity}`}
              {(order.items.length - 1) > 0 && ` +ещё ${order.items.length - 1}`}
            </span>
          </>
        )}
      </div>
      <div className={`${styles.cell} ${styles.cellBorder}`}>
        <span className={styles.amount}>{fmt(order.totalAmount)}</span>
        <span className={styles.payBadge} style={{ color: PAY_COLOR[order.paymentStatus] }}>
          {PAY_LABEL[order.paymentStatus]}
        </span>
      </div>
      <div className={styles.cellActions}>
        {order.paymentStatus === 'paid' ? (
          <span className={styles.statusBadge} style={{ '--badge-color': '#10B981' } as React.CSSProperties}>
            Оплачен
          </span>
        ) : (
          <div className={styles.unpaidAlert}>
            <AlertTriangle size={12} />
            {fmt(order.totalAmount - order.paidAmount)}
          </div>
        )}
      </div>
    </div>
  );
}
