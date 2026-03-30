import { useDeferredValue, useMemo, useState } from 'react';
import {
  AlertCircle, AlertTriangle, Archive, CheckCircle2, ChevronRight, Download,
  FileText, Package, PackageCheck, Phone, Plus, Search, Send, TrendingDown, User, X, CheckSquare,
} from 'lucide-react';
import {
  useWarehouseItems, useWarehouseMovements, useWarehouseAlerts,
  useWarehouseCategories, useCreateItem, useAddMovement, useDeleteItem, useResolveAlert,
} from '../../entities/warehouse/queries';
import {
  useInvoices, useConfirmWarehouse, useOrders, useShipOrder, useOrder, useArchiveInvoice,
  useCloseOrder,
} from '../../entities/order/queries';
import type { WarehouseItem, MovementType, CreateItemDto, AddMovementDto } from '../../entities/warehouse/types';
import type { ChapanInvoice, ChapanOrder } from '../../entities/order/types';
import { getStockStatus } from '../../entities/warehouse/types';
import { Skeleton } from '../../shared/ui/Skeleton';
import { exportToCSV } from '../../shared/lib/export';
import styles from './Warehouse.module.css';

type Tab = 'incoming' | 'invoice_archive' | 'orders_wh' | 'to_ship' | 'shipped' | 'items' | 'movements' | 'alerts';

const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: 'Приход', out: 'Расход', adjustment: 'Корректировка', write_off: 'Списание', return: 'Возврат',
};
const MOVEMENT_COLOR: Record<MovementType, string> = {
  in: 'var(--fill-positive)', out: 'var(--fill-negative)', adjustment: 'var(--fill-warning)',
  write_off: 'var(--fill-negative)', return: 'var(--fill-info)',
};

const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен', partial: 'Частично оплачен', paid: 'Оплачен',
};
const PAY_COLOR: Record<string, string> = {
  not_paid: 'var(--fill-negative)', partial: 'var(--fill-warning)', paid: 'var(--fill-positive)',
};
const URGENCY_LABEL: Record<string, string> = { normal: '', urgent: '🔴 Срочно' };
const URGENCY_COLOR: Record<string, string> = { normal: 'var(--text-tertiary)', urgent: '#D94F4F' };
const DEMANDING_LABEL = '⭐ Требовательный';
const DEMANDING_COLOR = '#C9A84C';
const DATE_FORMATTER = new Intl.DateTimeFormat('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
const NUMBER_FORMATTER = new Intl.NumberFormat('ru-KZ');
const MONEY_FORMATTER = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });

function fmtDate(s: string) {
  return DATE_FORMATTER.format(new Date(s));
}
function fmtNum(n: number) { return NUMBER_FORMATTER.format(n); }
function fmtMoney(n: number) {
  return MONEY_FORMATTER.format(n) + ' ₸';
}

// ── Invoice Detail Drawer ─────────────────────────────────────────────────────

function InvoiceDetailDrawer({ invoice, onClose }: { invoice: ChapanInvoice; onClose: () => void }) {
  const confirmWarehouse = useConfirmWarehouse();
  const archiveInvoice = useArchiveInvoice();
  const [downloading, setDownloading] = useState(false);
  const alreadyConfirmed = invoice.warehouseConfirmed;

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const { apiClient } = await import('../../shared/api/client');
      const response = await apiClient.get(`/chapan/invoices/${invoice.id}/download`, {
        params: { style: 'branded' },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nakladnaya-${invoice.invoiceNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      archiveInvoice.mutate(invoice.id);
    } finally {
      setDownloading(false);
    }
  }

  const orders = invoice.items?.map((it) => it.order).filter(Boolean) ?? [];

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>Накладная #{invoice.invoiceNumber}</div>
            <div className={styles.drawerSubtitle}>{fmtDate(invoice.createdAt)} · Создал: {invoice.createdByName}</div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.drawerStatusRow}>
          <div className={styles.drawerStatusItem}>
            {invoice.seamstressConfirmed
              ? <CheckCircle2 size={14} style={{ color: 'var(--fill-positive)', flexShrink: 0 }} />
              : <AlertCircle size={14} style={{ color: 'var(--fill-warning)', flexShrink: 0 }} />}
            <span style={{ color: invoice.seamstressConfirmed ? 'var(--fill-positive)' : 'var(--text-tertiary)' }}>
              {invoice.seamstressConfirmed ? `Цех отправил${invoice.seamstressConfirmedBy ? ` (${invoice.seamstressConfirmedBy})` : ''}` : 'Цех ещё не подтвердил'}
            </span>
          </div>
          <div className={styles.drawerStatusItem}>
            {alreadyConfirmed
              ? <CheckCircle2 size={14} style={{ color: 'var(--fill-positive)', flexShrink: 0 }} />
              : <AlertCircle size={14} style={{ color: 'var(--fill-warning)', flexShrink: 0 }} />}
            <span style={{ color: alreadyConfirmed ? 'var(--fill-positive)' : 'var(--text-tertiary)' }}>
              {alreadyConfirmed ? `Склад принял${invoice.warehouseConfirmedBy ? ` (${invoice.warehouseConfirmedBy})` : ''}` : 'Склад ещё не принял'}
            </span>
          </div>
        </div>

        <div className={styles.drawerBody}>
          {orders.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Нет заказов в накладной</div>
          )}

          {orders.map((order) => {
            const orderTotal = order.items?.reduce((s, i) => s + i.quantity * i.unitPrice, 0) ?? order.totalAmount;
            return (
              <div key={order.id} className={styles.invOrderCard}>
                <div className={styles.invOrderHead}>
                  <span className={styles.invOrderNum}>#{order.orderNumber}</span>
                  {(order.urgency ?? order.priority) === 'urgent' && (
                    <span style={{ fontSize: 11, color: URGENCY_COLOR['urgent'], fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${URGENCY_COLOR['urgent']}1a` }}>
                      {URGENCY_LABEL['urgent']}
                    </span>
                  )}
                  {(order.isDemandingClient ?? (order.priority === 'vip')) && (
                    <span style={{ fontSize: 11, color: DEMANDING_COLOR, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${DEMANDING_COLOR}1a` }}>
                      {DEMANDING_LABEL}
                    </span>
                  )}
                  <div className={styles.invOrderClient}>
                    <User size={12} /> {order.clientName}
                    {order.clientPhone && <><Phone size={12} style={{ marginLeft: 8 }} /> {order.clientPhone}</>}
                  </div>
                </div>

                <div className={styles.drawerTableWrap}>
                  <table>
                    <thead>
                      <tr>
                        {['Модель', 'Размер', 'Кол-во', 'Цена', 'Сумма'].map((h) => (
                          <th key={h} style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items ?? []).map((item) => (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.productName}</td>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.size}</td>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.quantity} шт.</td>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtMoney(item.unitPrice)}</td>
                          <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{fmtMoney(item.quantity * item.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.invOrderFoot}>
                  <span style={{ fontSize: 12, color: PAY_COLOR[order.paymentStatus] ?? 'var(--text-tertiary)', fontWeight: 600 }}>
                    {PAY_LABEL[order.paymentStatus] ?? order.paymentStatus}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Итого: {fmtMoney(orderTotal)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.drawerFooter}>
          <button
            className={styles.drawerActionBtn}
            onClick={() => void handleDownload()}
            disabled={downloading}
          >
            <Download size={15} />
            {downloading ? 'Скачивание...' : 'Скачать накладную'}
          </button>
          {alreadyConfirmed ? (
            <div className={styles.drawerConfirmedNotice}>
              <CheckCircle2 size={16} />
              Накладная принята — товар поступил на склад
            </div>
          ) : (
            <button
              className={`${styles.drawerActionBtn} ${styles.drawerActionBtnPrimary}`}
              onClick={() => { confirmWarehouse.mutate(invoice.id); onClose(); }}
              disabled={confirmWarehouse.isPending}
            >
              <PackageCheck size={16} />
              {confirmWarehouse.isPending ? 'Подтверждение...' : 'Подтвердить получение товара'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Order Detail Drawer (warehouse view) ──────────────────────────────────────

function OrderDetailDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: order, isLoading } = useOrder(orderId);
  const shipOrder = useShipOrder();
  const closeOrder = useCloseOrder();
  const [closeUnpaidWarning, setCloseUnpaidWarning] = useState(false);
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipFormData, setShipFormData] = useState({
    courierType: '',
    recipientName: '',
    recipientAddress: '',
    shippingNote: '',
  });

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {isLoading || !order ? (
          <>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>Загрузка...</span>
              <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
            </div>
            <div className={styles.drawerBody}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius={8} />)}
            </div>
          </>
        ) : (
          <>
            <div className={styles.drawerHeader}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div className={styles.drawerTitle}>#{order.orderNumber}</div>
                  {(order.urgency ?? order.priority) === 'urgent' && (
                    <span style={{ fontSize: 11, color: URGENCY_COLOR['urgent'], fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${URGENCY_COLOR['urgent']}1a`, flexShrink: 0 }}>
                      {URGENCY_LABEL['urgent']}
                    </span>
                  )}
                  {(order.isDemandingClient ?? (order.priority === 'vip')) && (
                    <span style={{ fontSize: 11, color: DEMANDING_COLOR, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${DEMANDING_COLOR}1a`, flexShrink: 0 }}>
                      {DEMANDING_LABEL}
                    </span>
                  )}
                </div>
                <div className={styles.drawerSubtitle} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> {order.clientName}</span>
                  {order.clientPhone && <a href={`tel:${order.clientPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', textDecoration: 'none' }}><Phone size={11} /> {order.clientPhone}</a>}
                  {order.dueDate && <span>Срок: {fmtDate(order.dueDate)}</span>}
                </div>
              </div>
              <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
            </div>

            <div className={styles.drawerBody}>
              {/* Items */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Позиции — {order.items?.length ?? 0} шт.
                </div>
                <div className={styles.drawerTableWrap}>
                  <table>
                    <tbody>
                      {(order.items ?? []).map((item, idx) => (
                        <tr key={item.id} style={{ borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {item.productName}
                            {item.fabric ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {item.fabric}</span> : null}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>р.{item.size}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>×{item.quantity}</td>
                          <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {fmtMoney(item.unitPrice * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-surface)' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Итого: {fmtMoney(order.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>Оплата</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 13, color: PAY_COLOR[order.paymentStatus], fontWeight: 700 }}>
                    {PAY_LABEL[order.paymentStatus]}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 12, color: 'var(--fill-positive)' }}>Оплачено: {fmtMoney(order.paidAmount)}</span>
                    {order.paidAmount < order.totalAmount && (
                      <span style={{ fontSize: 12, color: 'var(--fill-negative)' }}>Остаток: {fmtMoney(order.totalAmount - order.paidAmount)}</span>
                    )}
                  </div>
                </div>
                {order.expectedPaymentMethod && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Ожидаемый способ доплаты: <strong style={{ color: 'var(--text-primary)' }}>{order.expectedPaymentMethod}</strong>
                  </div>
                )}
              </div>

              {/* Invoice link */}
              {(order.invoiceOrders ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>Накладная</div>
                  {order.invoiceOrders!.map((io) => (
                    <div key={io.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '9px 12px', background: 'var(--bg-surface-inset)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <FileText size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      <span>Накладная #{io.invoice.invoiceNumber}</span>
                      <span style={{ marginLeft: 'auto', color: io.invoice.warehouseConfirmed ? 'var(--fill-positive)' : 'var(--fill-warning)', fontWeight: 600, flexShrink: 0 }}>
                        {io.invoice.warehouseConfirmed ? 'Принята' : 'Ожидает приёмки'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.drawerFooter}>
              {order.status === 'shipped' ? (
                <>
                  <button
                    className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}
                    onClick={() => {
                      if (order.paymentStatus !== 'paid') setCloseUnpaidWarning(true);
                      else { closeOrder.mutate(order.id); onClose(); }
                    }}
                    disabled={closeOrder.isPending}
                  >
                    <CheckSquare size={16} />
                    {closeOrder.isPending ? 'Закрытие...' : 'Завершить сделку'}
                  </button>
                  {closeUnpaidWarning && (
                    <div className={styles.drawerUnpaidNote}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                        <strong>Остаток: {fmtMoney(order.totalAmount - order.paidAmount)}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className={styles.drawerActionBtn} style={{ flex: 1, fontSize: 12 }} onClick={() => setCloseUnpaidWarning(false)}>Отмена</button>
                        <button className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`} style={{ flex: 1, fontSize: 12 }} onClick={() => { closeOrder.mutate(order.id); onClose(); }}>Закрыть всё равно</button>
                      </div>
                    </div>
                  )}
                </>
              ) : order.paymentStatus === 'paid' ? (
                <>
                  {showShipForm ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                        Пометки к отгрузке
                      </div>
                      {[
                        { key: 'courierType',      label: 'Способ доставки',         placeholder: 'Курьер, самовывоз, СДЭК…' },
                        { key: 'recipientName',    label: 'ФИО получателя',          placeholder: 'Иванов Иван Иванович' },
                        { key: 'recipientAddress', label: 'Адрес доставки',          placeholder: 'ул. Абая 10, кв. 5' },
                        { key: 'shippingNote',     label: 'Комментарий по доставке', placeholder: 'Любые дополнительные пометки' },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</div>
                          <input
                            style={{
                              width: '100%', boxSizing: 'border-box',
                              padding: '7px 10px', fontSize: 13,
                              background: 'var(--bg-surface-inset)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 6, color: 'var(--text-primary)',
                            }}
                            placeholder={placeholder}
                            value={shipFormData[key as keyof typeof shipFormData]}
                            onChange={(e) => setShipFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          className={styles.drawerActionBtn}
                          style={{ flex: 1, fontSize: 12 }}
                          onClick={() => setShowShipForm(false)}
                        >
                          Отмена
                        </button>
                        <button
                          className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}
                          style={{ flex: 2, fontSize: 12 }}
                          disabled={shipOrder.isPending}
                          onClick={() => {
                            shipOrder.mutate({
                              id: order.id,
                              courierType:      shipFormData.courierType.trim()      || undefined,
                              recipientName:    shipFormData.recipientName.trim()    || undefined,
                              recipientAddress: shipFormData.recipientAddress.trim() || undefined,
                              shippingNote:     shipFormData.shippingNote.trim()     || undefined,
                            }, { onSuccess: onClose });
                          }}
                        >
                          <Send size={14} />
                          {shipOrder.isPending ? 'Отправка...' : 'Подтвердить отгрузку'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}
                      onClick={() => setShowShipForm(true)}
                    >
                      <Send size={16} />
                      Отправить клиенту
                    </button>
                  )}
                </>
              ) : (
                <div className={styles.drawerUnpaidNote}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    <strong>Заказ не оплачен</strong>
                  </div>
                  <div style={{ marginTop: 4, paddingLeft: 23 }}>
                    Остаток: {fmtMoney(order.totalAmount - order.paidAmount)} — свяжитесь с менеджером
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Add Item Drawer ────────────────────────────────────────────────────────────

function AddItemDrawer({ onClose }: { onClose: () => void }) {
  const createItem = useCreateItem();
  const { data: catData } = useWarehouseCategories();
  const categories = catData?.results ?? [];
  const [form, setForm] = useState<CreateItemDto>({ name: '', unit: 'шт', qty: 0, qtyMin: 0 });
  const sf = (k: keyof CreateItemDto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await createItem.mutateAsync({ ...form, qty: Number(form.qty), qtyMin: Number(form.qtyMin) });
    onClose();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Добавить позицию</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Название <span className={styles.req}>*</span></label>
            <input className={styles.input} value={form.name} onChange={sf('name')} placeholder="Шерсть кашемир" required autoFocus />
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Уникальный номер</label>
              <input className={styles.input} value={form.sku ?? ''} onChange={sf('sku')} placeholder="WOOL-01" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ед. изм.</label>
              <input className={styles.input} value={form.unit ?? 'шт'} onChange={sf('unit')} placeholder="шт / кг / м" />
            </div>
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Остаток</label>
              <input className={styles.input} type="number" min="0" value={form.qty ?? 0} onChange={sf('qty')} onFocus={(e) => e.target.select()} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Минимум (алерт)</label>
              <input className={styles.input} type="number" min="0" value={form.qtyMin ?? 0} onChange={sf('qtyMin')} onFocus={(e) => e.target.select()} />
            </div>
          </div>
          {categories.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Категория</label>
              <select className={styles.select} value={form.categoryId ?? ''} onChange={sf('categoryId')}>
                <option value="">Без категории</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Цена закупки (₸)</label>
            <input className={styles.input} type="number" min="0" value={form.costPrice ?? ''} onChange={sf('costPrice')} placeholder="0" />
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={createItem.isPending}>
              {createItem.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Movement Drawer ────────────────────────────────────────────────────────

function AddMovementDrawer({ items, preselectItemId, onClose }: { items: WarehouseItem[]; preselectItemId?: string; onClose: () => void }) {
  const addMovement = useAddMovement();
  const [form, setForm] = useState<AddMovementDto>({ itemId: preselectItemId ?? '', type: 'in', qty: 1, reason: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.itemId || !form.qty) return;
    await addMovement.mutateAsync({ ...form, qty: Number(form.qty) });
    onClose();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Новое движение</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Тип операции</label>
            <div className={styles.typeGroup}>
              {(['in','out','adjustment','write_off'] as MovementType[]).map(t => (
                <button key={t} type="button"
                  className={`${styles.typeBtn} ${form.type === t ? styles.typeBtnActive : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ '--tc': MOVEMENT_COLOR[t] } as React.CSSProperties}
                >{MOVEMENT_LABEL[t]}</button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Позиция <span className={styles.req}>*</span></label>
            <select className={styles.select} value={form.itemId} onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))} required>
              <option value="">Выберите позицию</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Количество <span className={styles.req}>*</span></label>
              <input className={styles.input} type="number" min="0.01" step="any" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: parseFloat(e.target.value) || 0 }))} onFocus={(e) => e.target.select()} required />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Причина / Комментарий</label>
            <input className={styles.input} value={form.reason ?? ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Поступление от поставщика..." />
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={addMovement.isPending}>
              {addMovement.isPending ? 'Запись...' : 'Записать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Clickable table row helper ────────────────────────────────────────────────

function ClickRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <tr
      className={styles.row}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const [tab, setTab] = useState<Tab>('items');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addMovOpen, setAddMovOpen] = useState(false);
  const [preselectItem, setPreselectItem] = useState<string | undefined>();

  // Detail drawers
  const [selectedInvoice, setSelectedInvoice] = useState<ChapanInvoice | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Inventory data
  const { data: itemsData, isLoading: itemsLoading } = useWarehouseItems({ search: deferredSearch || undefined });
  const { data: movData, isLoading: movLoading } = useWarehouseMovements({ limit: 100 });
  const { data: alertsData } = useWarehouseAlerts();
  const deleteItem = useDeleteItem();
  const resolveAlert = useResolveAlert();

  // Chapan handoff data
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ status: 'pending_confirmation', limit: 200 });
  const { data: archivedInvoicesData, isLoading: archivedInvoicesLoading } = useInvoices({ status: 'archived', limit: 200 });
  const archivedInvoices: ChapanInvoice[] = useMemo(() => archivedInvoicesData?.results ?? [], [archivedInvoicesData?.results]);
  const pendingInvoices: ChapanInvoice[] = useMemo(
    () => (invoicesData?.results ?? []).filter((inv) => !inv.warehouseConfirmed),
    [invoicesData?.results],
  );
  const { data: whOrdersData, isLoading: whOrdersLoading } = useOrders({ status: 'on_warehouse', limit: 200 });
  const warehouseOrders: ChapanOrder[] = useMemo(() => whOrdersData?.results ?? [], [whOrdersData?.results]);
  const toShipOrders = useMemo(
    () => warehouseOrders.filter((o) => o.paymentStatus === 'paid'),
    [warehouseOrders],
  );
  const unpaidOrders = useMemo(
    () => warehouseOrders.filter((o) => o.paymentStatus !== 'paid'),
    [warehouseOrders],
  );

  // Partial warehouse orders
  const { data: partialWhData, isLoading: partialWhLoading } = useOrders({ hasWarehouseItems: true, limit: 200 });
  const partialWarehouseOrders: ChapanOrder[] = useMemo(() => partialWhData?.results ?? [], [partialWhData?.results]);
  const { data: shippedOrdersData, isLoading: shippedOrdersLoading } = useOrders({ status: 'shipped', limit: 200 });
  const shippedOrders: ChapanOrder[] = useMemo(() => shippedOrdersData?.results ?? [], [shippedOrdersData?.results]);

  const items = useMemo(() => itemsData?.results ?? [], [itemsData?.results]);
  const movements = useMemo(() => movData?.results ?? [], [movData?.results]);
  const alerts = useMemo(() => alertsData?.results ?? [], [alertsData?.results]);
  const alertCount = alerts.length;
  const incomingCount = pendingInvoices.length;
  const totalUnits = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);

  function handleExportItems() {
    exportToCSV(items.map(i => ({
      'Название': i.name, 'Уникальный номер': i.sku ?? '', 'Ед.изм': i.unit,
      'Остаток': i.qty, 'Мин.остаток': i.qtyMin, 'Категория': i.category?.name ?? '', 'Цена закупки': i.costPrice ?? '',
    })), 'склад_остатки.csv');
  }
  function handleExportMovements() {
    exportToCSV(movements.map(m => ({
      'Дата': fmtDate(m.createdAt), 'Тип': MOVEMENT_LABEL[m.type], 'Позиция': m.item?.name ?? m.itemId,
      'Количество': m.qty, 'Причина': m.reason ?? '', 'Автор': m.author,
    })), 'склад_движения.csv');
  }

  return (
    <div className={styles.root}>
      {/* Header + tabs */}
      <div className={styles.header}>
        <h1 className={styles.title}>Склад</h1>
        <div className={styles.headerRight}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'items' ? styles.tabActive : ''}`} onClick={() => setTab('items')}>
              <Package size={13} /> Остатки
            </button>
            <button className={`${styles.tab} ${tab === 'movements' ? styles.tabActive : ''}`} onClick={() => setTab('movements')}>
              <TrendingDown size={13} /> Движения
            </button>
            <button className={`${styles.tab} ${tab === 'alerts' ? styles.tabActive : ''}`} onClick={() => setTab('alerts')}>
              <AlertTriangle size={13} /> Оповещения {alertCount > 0 && <span className={styles.alertBadge}>{alertCount}</span>}
            </button>

            <div className={styles.tabDivider} />
            <span className={styles.tabGroupLabel}>Чапан</span>

            <button className={`${styles.tab} ${tab === 'incoming' ? styles.tabActive : ''}`} onClick={() => setTab('incoming')}>
              <FileText size={13} /> Приёмка {incomingCount > 0 && <span className={styles.alertBadge}>{incomingCount}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'invoice_archive' ? styles.tabActive : ''}`} onClick={() => setTab('invoice_archive')}>
              <Archive size={13} /> Архив накладных
            </button>
            <button className={`${styles.tab} ${tab === 'orders_wh' ? styles.tabActive : ''}`} onClick={() => setTab('orders_wh')}>
              <Package size={13} /> Заказы {(warehouseOrders.length + partialWarehouseOrders.length) > 0 && <span className={styles.alertBadge}>{warehouseOrders.length + partialWarehouseOrders.length}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'to_ship' ? styles.tabActive : ''}`} onClick={() => setTab('to_ship')}>
              <Send size={13} /> К отправке {toShipOrders.length > 0 && <span className={styles.alertBadge}>{toShipOrders.length}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'shipped' ? styles.tabActive : ''}`} onClick={() => setTab('shipped')}>
              <CheckSquare size={13} /> Отгружено {shippedOrders.length > 0 && <span className={styles.alertBadge}>{shippedOrders.length}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {!itemsLoading && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{items.length}</span>
            <span className={styles.statLabel}>Позиций в базе</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{fmtNum(totalUnits)}</span>
            <span className={styles.statLabel}>Единиц на складе</span>
          </div>
          {alertCount > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: 'var(--fill-warning)' }}>{alertCount}</span>
              <span className={styles.statLabel}>Алертов</span>
            </div>
          )}
          {incomingCount > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: 'var(--fill-accent)' }}>{incomingCount}</span>
              <span className={styles.statLabel}>Накладных на приёмку</span>
            </div>
          )}
        </div>
      )}

      {/* ── Приёмка tab ── */}
      {tab === 'incoming' && (
        invoicesLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={56} radius={8} />)}</div>
        ) : pendingInvoices.length === 0 ? (
          <div className={styles.empty}>
            <PackageCheck size={32} className={styles.emptyIcon} />
            <p>Нет входящих накладных</p>
            <span className={styles.emptyNote}>Когда цех отправит заказы на склад, накладные появятся здесь</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Накладная</th><th>Дата</th><th>Заказов</th><th>Создал</th><th>Статус цеха</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map((inv) => (
                  <ClickRow key={inv.id} onClick={() => setSelectedInvoice(inv)}>
                    <td className={styles.tdName}>#{inv.invoiceNumber}</td>
                    <td className={styles.tdDate}>{fmtDate(inv.createdAt)}</td>
                    <td className={styles.tdNum}>{inv.items?.length ?? 0} заказ(а)</td>
                    <td className={styles.tdSecondary}>{inv.createdByName}</td>
                    <td>
                      {inv.seamstressConfirmed
                        ? <span style={{ color: 'var(--fill-positive)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Цех отправил</span>
                        : <span style={{ color: 'var(--fill-warning)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} /> Ожидает цех</span>}
                    </td>
                    <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.incomBtn}
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <FileText size={12} /> Открыть
                      </button>
                    </td>
                  </ClickRow>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Архив накладных tab ── */}
      {tab === 'invoice_archive' && (
        archivedInvoicesLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={56} radius={8} />)}</div>
        ) : archivedInvoices.length === 0 ? (
          <div className={styles.empty}>
            <Archive size={32} className={styles.emptyIcon} />
            <p>Архив пуст</p>
            <span className={styles.emptyNote}>Накладные появятся здесь после скачивания</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Накладная</th><th>Дата</th><th>Заказов</th><th>Создал</th><th></th>
                </tr>
              </thead>
              <tbody>
                {archivedInvoices.map((inv) => (
                  <ClickRow key={inv.id} onClick={() => setSelectedInvoice(inv)}>
                    <td className={styles.tdName}>#{inv.invoiceNumber}</td>
                    <td className={styles.tdDate}>{fmtDate(inv.createdAt)}</td>
                    <td className={styles.tdNum}>{inv.items?.length ?? 0} заказ(а)</td>
                    <td className={styles.tdSecondary}>{inv.createdByName}</td>
                    <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.incomBtn} onClick={() => setSelectedInvoice(inv)}>
                        <FileText size={12} /> Открыть
                      </button>
                    </td>
                  </ClickRow>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Заказы на складе tab ── */}
      {tab === 'orders_wh' && (
        (whOrdersLoading || partialWhLoading) ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}</div>
        ) : warehouseOrders.length === 0 && partialWarehouseOrders.length === 0 ? (
          <div className={styles.empty}>
            <Package size={32} className={styles.emptyIcon} />
            <p>Склад пуст</p>
            <span className={styles.emptyNote}>Принятые заказы появятся после подтверждения накладных</span>
          </div>
        ) : (
          <>
            {warehouseOrders.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Заказ</th><th>Клиент</th><th>Телефон</th><th>Позиции</th><th>Сумма</th><th>Оплата</th><th></th></tr>
                  </thead>
                  <tbody>
                    {warehouseOrders.map((order) => (
                      <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                        <td className={styles.tdMono}>#{order.orderNumber}</td>
                        <td className={styles.tdName}>{order.clientName}</td>
                        <td className={styles.tdSecondary} style={{ fontSize: 12 }}>{order.clientPhone}</td>
                        <td className={styles.tdSecondary}>
                          {(order.items ?? []).slice(0, 2).map((i) => i.productName).join(', ')}
                          {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
                        </td>
                        <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                        <td>
                          <span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>
                            {order.paymentStatus === 'paid' ? 'Оплачен' : order.paymentStatus === 'partial' ? 'Частично' : 'Не оплачен'}
                          </span>
                        </td>
                        <td className={styles.tdActions} style={{ color: 'var(--text-tertiary)' }}>
                          <ChevronRight size={14} />
                        </td>
                      </ClickRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {partialWarehouseOrders.length > 0 && (
              <>
                <div className={styles.sectionLabel}>
                  Ожидает производство — {partialWarehouseOrders.length} {partialWarehouseOrders.length === 1 ? 'заказ' : partialWarehouseOrders.length < 5 ? 'заказа' : 'заказов'}
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Заказ</th><th>Клиент</th><th>Позиции</th><th>Сумма</th><th>Статус</th><th></th></tr>
                    </thead>
                    <tbody>
                      {partialWarehouseOrders.map((order) => {
                        const whItems = order.items.filter(i => i.fulfillmentMode === 'warehouse');
                        const prodItems = order.items.filter(i => i.fulfillmentMode === 'production');
                        return (
                          <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                            <td className={styles.tdMono}>#{order.orderNumber}</td>
                            <td className={styles.tdName}>{order.clientName}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {whItems.map(i => (
                                  <span key={i.id} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fill-positive)' }}>
                                    <CheckCircle2 size={11} /> {i.productName}{i.quantity > 1 ? ` ×${i.quantity}` : ''}
                                  </span>
                                ))}
                                {prodItems.map(i => (
                                  <span key={i.id} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)' }}>
                                    <AlertCircle size={11} /> {i.productName}{i.quantity > 1 ? ` ×${i.quantity}` : ''} — в производстве
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                            <td>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,.1)', color: '#F59E0B', fontWeight: 500 }}>
                                В производстве
                              </span>
                            </td>
                            <td className={styles.tdActions} style={{ color: 'var(--text-tertiary)' }}>
                              <ChevronRight size={14} />
                            </td>
                          </ClickRow>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )
      )}

      {/* ── К отправке tab ── */}
      {tab === 'to_ship' && (
        whOrdersLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}</div>
        ) : toShipOrders.length === 0 && unpaidOrders.length === 0 ? (
          <div className={styles.empty}>
            <Send size={32} className={styles.emptyIcon} />
            <p>Нет заказов к отправке</p>
            <span className={styles.emptyNote}>Оплаченные заказы со склада будут готовы к отгрузке</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Заказ</th><th>Клиент</th><th>Телефон</th><th>Позиции</th><th>Сумма</th><th>Оплата</th><th></th></tr>
              </thead>
              <tbody>
                {toShipOrders.map((order) => (
                  <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary} style={{ fontSize: 12 }}>{order.clientPhone}</td>
                    <td className={styles.tdSecondary}>
                      {(order.items ?? []).slice(0, 2).map((i) => i.productName).join(', ')}
                      {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
                    </td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td><span style={{ color: 'var(--fill-positive)', fontWeight: 500, fontSize: 12 }}>Оплачен</span></td>
                    <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.incomBtn}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <Send size={12} /> Открыть
                      </button>
                    </td>
                  </ClickRow>
                ))}
                {unpaidOrders.map((order) => (
                  <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary} style={{ fontSize: 12 }}>{order.clientPhone}</td>
                    <td className={styles.tdSecondary}>
                      {(order.items ?? []).slice(0, 2).map((i) => i.productName).join(', ')}
                      {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
                    </td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td><span style={{ color: 'var(--fill-negative)', fontWeight: 500, fontSize: 12 }}>Не оплачен</span></td>
                    <td className={styles.tdActions} style={{ color: 'var(--text-tertiary)' }}>
                      <ChevronRight size={14} />
                    </td>
                  </ClickRow>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Отгружено tab ── */}
      {tab === 'shipped' && (
        shippedOrdersLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}</div>
        ) : shippedOrders.length === 0 ? (
          <div className={styles.empty}>
            <CheckSquare size={32} className={styles.emptyIcon} />
            <p>Отгрузок пока нет</p>
            <span className={styles.emptyNote}>Отправленные клиентам заказы появятся здесь</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Заказ</th><th>Клиент</th><th>Телефон</th><th>Позиции</th><th>Сумма</th><th>Оплата</th><th></th></tr>
              </thead>
              <tbody>
                {shippedOrders.map((order) => (
                  <ClickRow key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary} style={{ fontSize: 12 }}>{order.clientPhone}</td>
                    <td className={styles.tdSecondary}>
                      {(order.items ?? []).slice(0, 2).map((i) => i.productName).join(', ')}
                      {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
                    </td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td><span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>{PAY_LABEL[order.paymentStatus]}</span></td>
                    <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.incomBtn} onClick={() => setSelectedOrderId(order.id)}>
                        <CheckSquare size={12} /> Завершить
                      </button>
                    </td>
                  </ClickRow>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Остатки tab ── */}
      {tab === 'items' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={13} className={styles.searchIcon} />
              <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию..." />
            </div>
            <button className={styles.exportBtn} onClick={handleExportItems}><Download size={13} /> Excel</button>
            <button className={styles.addBtn} onClick={() => setAddItemOpen(true)}><Plus size={14} /> Добавить</button>
          </div>

          {itemsLoading ? (
            <div className={styles.skeletons}>{[...Array(6)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Название</th><th>Уникальный номер</th><th>Кат.</th><th>Остаток</th><th>Мин.</th><th>Статус</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const status = getStockStatus(item);
                    return (
                      <tr key={item.id} className={styles.row}>
                        <td className={styles.tdName}>{item.name}</td>
                        <td className={styles.tdMono}>{item.sku ?? '—'}</td>
                        <td className={styles.tdSecondary}>{item.category?.name ?? '—'}</td>
                        <td className={styles.tdNum}>{fmtNum(item.qty)} {item.unit}</td>
                        <td className={styles.tdSecondary}>{fmtNum(item.qtyMin)} {item.unit}</td>
                        <td>
                          <span className={styles.stockBadge} data-status={status}>
                            {status === 'ok' ? 'Норма' : status === 'low' ? 'Мало' : 'Критично'}
                          </span>
                        </td>
                        <td className={styles.tdActions}>
                          <button className={styles.incomBtn} onClick={() => { setPreselectItem(item.id); setAddMovOpen(true); }}>Приход</button>
                          <button className={styles.deleteBtn} onClick={() => { if (confirm('Удалить позицию?')) deleteItem.mutate(item.id); }}><X size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className={styles.empty}>
                  <Package size={32} className={styles.emptyIcon} />
                  <p>Склад пуст</p>
                  <button className={styles.emptyBtn} onClick={() => setAddItemOpen(true)}>Добавить первую позицию</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Движения tab ── */}
      {tab === 'movements' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarSpacer} />
            <button className={styles.exportBtn} onClick={handleExportMovements}><Download size={13} /> Excel</button>
            <button className={styles.addBtn} onClick={() => { setPreselectItem(undefined); setAddMovOpen(true); }}>
              <Plus size={14} /> Новое движение
            </button>
          </div>

          {movLoading ? (
            <div className={styles.skeletons}>{[...Array(8)].map((_, i) => <Skeleton key={i} height={48} radius={8} />)}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Дата</th><th>Тип</th><th>Позиция</th><th>Кол-во</th><th>Причина</th><th>Автор</th></tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id} className={styles.row}>
                      <td className={styles.tdDate}>{fmtDate(m.createdAt)}</td>
                      <td>
                        <span className={styles.movBadge} style={{ color: MOVEMENT_COLOR[m.type], background: `${MOVEMENT_COLOR[m.type]}18` }}>
                          {MOVEMENT_LABEL[m.type]}
                        </span>
                      </td>
                      <td className={styles.tdName}>{m.item?.name ?? m.itemId}</td>
                      <td className={styles.tdNum} style={{ color: m.type === 'in' || m.type === 'return' ? 'var(--fill-positive)' : 'var(--fill-negative)' }}>
                        {m.type === 'in' || m.type === 'return' ? '+' : '-'}{fmtNum(m.qty)} {m.item?.unit}
                      </td>
                      <td className={styles.tdSecondary}>{m.reason ?? '—'}</td>
                      <td className={styles.tdSecondary}>{m.author}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movements.length === 0 && (
                <div className={styles.empty}>
                  <TrendingDown size={32} className={styles.emptyIcon} />
                  <p>Движений пока нет</p>
                  <button className={styles.emptyBtn} onClick={() => setAddMovOpen(true)}>Записать первое движение</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Оповещения tab ── */}
      {tab === 'alerts' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Позиция</th><th>Остаток</th><th>Минимум</th><th>Ед.</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id} className={styles.row}>
                  <td className={styles.tdName}>{a.item?.name ?? '—'}</td>
                  <td className={styles.tdNum} style={{ color: 'var(--fill-negative)' }}>{fmtNum(a.item?.qty ?? 0)}</td>
                  <td className={styles.tdSecondary}>{fmtNum(a.item?.qtyMin ?? 0)}</td>
                  <td className={styles.tdSecondary}>{a.item?.unit ?? '—'}</td>
                  <td><span className={styles.alertStatusBadge}>Низкий остаток</span></td>
                  <td className={styles.tdActions}>
                    <button className={styles.incomBtn} onClick={() => { setPreselectItem(a.itemId); setAddMovOpen(true); setTab('movements'); }}>Записать приход</button>
                    <button className={styles.resolveBtn} onClick={() => resolveAlert.mutate(a.id)}>Закрыть</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && (
            <div className={styles.empty}>
              <AlertTriangle size={32} className={styles.emptyIcon} style={{ color: 'var(--fill-positive)' }} />
              <p>Все в норме</p>
              <span className={styles.emptyNote}>Оповещения появятся когда остаток упадёт ниже минимума</span>
            </div>
          )}
        </div>
      )}

      {/* Drawers */}
      {addItemOpen && <AddItemDrawer onClose={() => setAddItemOpen(false)} />}
      {addMovOpen && (
        <AddMovementDrawer items={items} preselectItemId={preselectItem} onClose={() => { setAddMovOpen(false); setPreselectItem(undefined); }} />
      )}
      {selectedInvoice && (
        <InvoiceDetailDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
      {selectedOrderId && (
        <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      )}
    </div>
  );
}
