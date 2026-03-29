import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Clock, CreditCard, MessageSquare, AlertTriangle, Pencil, ArchiveIcon, RotateCcw, Download, Package, XCircle, FileText } from 'lucide-react';
import { useOrder, useFulfillFromStock, useConfirmOrder, useChangeOrderStatus, useAddPayment, useAddOrderActivity, useRestoreOrder, useCloseOrder, useCreateInvoice, useSetRequiresInvoice, useConfirmSeamstress, useRouteSingleItem } from '../../../../entities/order/queries';
import { useProductsAvailability } from '../../../../entities/warehouse/queries';
import type { OrderItem, OrderItemFulfillmentMode, OrderStatus, Priority } from '../../../../entities/order/types';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from '../../../../shared/api/client';
import { useChapanUiStore } from '../../../../features/workzone/chapan/store';
import styles from './ChapanOrderDetail.module.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  in_production: 'В цехе',
  ready: 'Готов',
  transferred: 'Передан',
  on_warehouse: 'На складе',
  shipped: 'Отправлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#7C3AED',
  confirmed: '#C9A84C',
  in_production: '#E5922A',
  ready: '#4FC999',
  transferred: '#A78BFA',
  on_warehouse: '#8B5CF6',
  shipped: '#3B82F6',
  completed: 'rgba(240,232,212,.35)',
  cancelled: '#D94F4F',
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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  kaspi_qr: 'Kaspi QR',
  kaspi_terminal: 'Kaspi терминал',
  transfer: 'Перевод',
  mixed: 'Смешанный',
};

const PROD_STATUS_LABEL: Record<string, string> = {
  queued: 'Очередь',
  in_progress: 'В работе',
  done: 'Готово',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  normal: 'Обычный',
  urgent: 'Срочно',
  vip: 'VIP',
};

const ROUTE_LABEL: Record<OrderItemFulfillmentMode, string> = {
  unassigned: 'Не выбран',
  warehouse: 'Готово',
  production: 'В производство',
};

function fmt(n: number) {
  return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
}

function fmtDatetime(s: string) {
  return new Date(s).toLocaleString('ru-KZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPaymentMethod(method: string) {
  return PAYMENT_METHOD_LABEL[method] ?? method;
}

function formatItemMeta(item: Pick<OrderItem, 'fabric' | 'size' | 'quantity'>) {
  const meta = [item.fabric, item.size].filter(Boolean).join(' · ');
  return item.quantity > 1 ? `${meta}${meta ? ' · ' : ''}× ${item.quantity}` : meta;
}

function resolveItemFulfillmentMode(order: { status: OrderStatus; productionTasks?: Array<{ orderItemId: string }> }, item: OrderItem): OrderItemFulfillmentMode {
  if (item.fulfillmentMode === 'warehouse' || item.fulfillmentMode === 'production') return item.fulfillmentMode;
  const hasTask = (order.productionTasks ?? []).some((task) => task.orderItemId === item.id);
  if (hasTask) return 'production';
  if (['ready', 'on_warehouse', 'shipped', 'completed'].includes(order.status)) return 'warehouse';
  return 'unassigned';
}

async function downloadInvoice(orderId: string, orderNumber: string) {
  const response = await apiClient.get(`/chapan/orders/${orderId}/invoice`, {
    params: { style: 'branded' },
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nakladnaya-${orderNumber}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const paySchema = z.object({
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  method: z.string().min(1),
  note: z.string().optional(),
});

type PayForm = z.infer<typeof paySchema>;

export default function ChapanOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const setSelectedOrderId = useChapanUiStore((state) => state.setSelectedOrderId);

  const detailContext = (() => {
    if (location.pathname.startsWith('/workzone/chapan/ready/')) {
      return { backPath: '/workzone/chapan/ready', backLabel: 'Готово' };
    }
    if (location.pathname.startsWith('/workzone/chapan/archive/')) {
      return { backPath: '/workzone/chapan/archive', backLabel: 'Архив' };
    }
    if (location.pathname.startsWith('/warehouse/')) {
      return { backPath: '/warehouse', backLabel: 'Склад' };
    }
    return { backPath: '/workzone/chapan/orders', backLabel: 'Заказы' };
  })();

  const { data: order, isLoading, isError } = useOrder(id!);
  const fulfillFromStock = useFulfillFromStock();
  const confirmOrder = useConfirmOrder();
  const changeStatus = useChangeOrderStatus();
  const addPayment = useAddPayment();
  const addActivity = useAddOrderActivity();
  const restoreOrder = useRestoreOrder();
  const closeOrder = useCloseOrder();
  const createInvoice = useCreateInvoice();
  const setRequiresInvoice = useSetRequiresInvoice();
  const confirmSeamstress = useConfirmSeamstress();
  const routeSingleItem = useRouteSingleItem();

  const pendingInvoice = order?.status === 'ready'
    ? order.invoiceOrders?.find((io) => io.invoice.status === 'pending_confirmation')?.invoice
    : undefined;

  const productNames = [...new Set((order?.items ?? []).map((item) => item.productName).filter(Boolean))];
  const { data: stockMap } = useProductsAvailability(productNames);

  const [showPayForm, setShowPayForm] = useState(false);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [restorePromptOpen, setRestorePromptOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [closeUnpaidWarning, setCloseUnpaidWarning] = useState(false);
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);

  const {
    register: registerPay,
    handleSubmit: handlePaySubmit,
    reset: resetPay,
    setValue: setPayValue,
    watch: watchPay,
    formState: { errors: payErrors },
  } = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { method: 'cash' },
  });

  const payAmount = watchPay('amount');

  async function onPaySubmit(data: PayForm) {
    if (!id) return;
    await addPayment.mutateAsync({ id, dto: data });
    resetPay({ method: 'cash' });
    setShowPayForm(false);
  }

  async function handleComment() {
    if (!comment.trim() || !id) return;
    setSubmittingComment(true);
    try {
      await addActivity.mutateAsync({ id, content: comment.trim() });
      setComment('');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleInvoiceDownload() {
    if (!id || !order || invoiceDownloading) return;
    setInvoiceDownloading(true);
    try {
      await downloadInvoice(id, order.orderNumber);
    } finally {
      setInvoiceDownloading(false);
    }
  }

  async function handleTransferToWarehouse() {
    if (!order) return;
    try {
      if (order.requiresInvoice) {
        // Create накладная — stay on page; order detail will show pending invoice state
        await createInvoice.mutateAsync({ orderIds: [order.id] });
      } else {
        // No invoice required — directly set status
        await changeStatus.mutateAsync({ id: order.id, status: 'on_warehouse' });
      }
    } catch {
      // error toast handled in mutation
    }
  }

  if (isLoading) {
    return <div className={styles.root}><div className={styles.loadingSkeleton}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonBlock} />)}</div></div>;
  }

  if (isError || !order) {
    return (
      <div className={styles.root}>
        <div className={styles.errorState}>
          <AlertTriangle size={24} />
          <p>Заказ не найден</p>
          <button onClick={() => { setSelectedOrderId(null); navigate(detailContext.backPath); }}>← Вернуться</button>
        </div>
      </div>
    );
  }
  const balance = order.totalAmount - order.paidAmount;
  const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && order.status !== 'completed';
  const orderItems = order.items ?? [];
  const productionTaskByItemId = new Map((order.productionTasks ?? []).map((task) => [task.orderItemId, task]));
  const currentRoutes = Object.fromEntries(orderItems.map((item) => [item.id, resolveItemFulfillmentMode(order, item)]));

  const warehouseItems = orderItems.filter((item) => currentRoutes[item.id] === 'warehouse');
  const productionItems = orderItems.filter((item) => currentRoutes[item.id] === 'production');
  const allInStock = orderItems.length > 0 && orderItems.every((item) => {
    const stock = stockMap?.[item.productName];
    return (stock?.qty ?? 0) >= item.quantity;
  });

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <button className={styles.backLink} onClick={() => { setSelectedOrderId(null); navigate(detailContext.backPath); }}>
          <ChevronLeft size={14} />
          <span>{detailContext.backLabel}</span>
        </button>
        <div className={styles.orderMeta}>
          <h1 className={styles.orderNum}>#{order.orderNumber}</h1>
          <span className={styles.statusChip} style={{ '--sc': STATUS_COLOR[order.status] } as React.CSSProperties}>{STATUS_LABEL[order.status]}</span>
          {order.priority !== 'normal' && <span className={styles.priorityChip}>{PRIORITY_LABEL[order.priority]}</span>}
          {isOverdue && <span className={styles.overdueChip}>Просрочен</span>}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.col}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Клиент</div>
            <div className={styles.clientName}>{order.clientName}</div>
            <a href={`tel:${order.clientPhone}`} className={styles.clientPhone}>{order.clientPhone}</a>
            {order.city && (
              <div className={styles.clientDeadline} style={{ color: 'rgba(240,232,212,.65)' }}>
                🏙 {order.city}
              </div>
            )}
            {(order as any).deliveryType && (
              <div className={styles.clientDeadline} style={{ color: 'rgba(240,232,212,.65)' }}>
                📦 {(order as any).deliveryType}
              </div>
            )}
            {(order as any).source && (
              <div className={styles.clientDeadline} style={{ color: 'rgba(240,232,212,.45)' }}>
                Источник: {(order as any).source}
              </div>
            )}
            {order.dueDate && (
              <div className={styles.clientDeadline} style={{ color: isOverdue ? '#D94F4F' : 'rgba(240,232,212,.45)' }}>
                Дедлайн: {new Date(order.dueDate).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Позиции заказа</div>
            <div className={styles.itemsList}>
              {(order.items ?? []).map((item) => {
                const stock = stockMap?.[item.productName];
                const hasEnoughStock = (stock?.qty ?? 0) >= item.quantity;
                const route = currentRoutes[item.id] ?? 'unassigned';

                const task = productionTaskByItemId.get(item.id);
                const badgeLabel = route === 'production' && task && order.status !== 'new'
                  ? (PROD_STATUS_LABEL[task.status] ?? ROUTE_LABEL[route])
                  : ROUTE_LABEL[route];
                const badgeClass = route === 'warehouse'
                  ? styles.routeBadgeWarehouse
                  : route === 'production'
                    ? (task?.status === 'done' ? styles.routeBadgeDone : styles.routeBadgeProduction)
                    : styles.routeBadgePending;

                const isRouteable = ['new', 'confirmed', 'in_production'].includes(order.status);
                const isTerminal = ['ready', 'transferred', 'on_warehouse', 'shipped', 'completed', 'cancelled'].includes(order.status);

                return (
                  <div key={item.id} className={styles.itemRow}>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemHead}>
                        <span className={styles.itemName}>{item.productName}</span>
                        {isTerminal && (
                          <span className={`${styles.routeBadge} ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        )}
                      </div>
                      <span className={styles.itemMeta}>{formatItemMeta(item)}</span>
                      {item.workshopNotes && <span className={styles.itemNote}>↳ {item.workshopNotes}</span>}
                      {order.status === 'new' && stock !== undefined && (
                        <span className={hasEnoughStock ? styles.stockBadgeIn : styles.stockBadgeOut}>
                          {hasEnoughStock ? <><CheckCircle2 size={10} /> В наличии ({stock.qty} шт.)</> : <><XCircle size={10} /> Нет в наличии</>}
                        </span>
                      )}
                      {isRouteable && (
                        <div className={styles.routeActions}>
                          <button
                            type="button"
                            className={`${styles.routeActionBtn} ${route === 'warehouse' ? styles.routeActionBtnActive : ''}`}
                            onClick={() => routeSingleItem.mutate({ orderId: order.id, itemId: item.id, fulfillmentMode: 'warehouse' })}
                            disabled={routeSingleItem.isPending || route === 'warehouse'}
                          >
                            Готово
                          </button>
                          <button
                            type="button"
                            className={`${styles.routeActionBtn} ${styles.routeActionBtnPrimary} ${route === 'production' ? styles.routeActionBtnActive : ''}`}
                            onClick={() => routeSingleItem.mutate({ orderId: order.id, itemId: item.id, fulfillmentMode: 'production' })}
                            disabled={routeSingleItem.isPending || route === 'production'}
                          >
                            В производство
                          </button>
                        </div>
                      )}
                    </div>
                    <span className={styles.itemPrice}>{fmt(item.quantity * item.unitPrice)}</span>
                  </div>
                );
              })}
              {(order.items ?? []).length === 0 && <div className={styles.noItems}>Позиции не указаны</div>}
            </div>
            <div className={styles.itemsTotal}><span>Итого:</span><strong>{fmt(order.totalAmount)}</strong></div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Финансы</div>
            <div className={styles.finTable}>
              <div className={styles.finRow}><span>Сумма заказа</span><strong>{fmt(order.totalAmount)}</strong></div>
              <div className={styles.finRow}><span>Оплачено</span><strong style={{ color: '#4FC999' }}>{fmt(order.paidAmount)}</strong></div>
              <div className={`${styles.finRow} ${styles.finRowBalance}`}><span>Остаток</span><strong style={{ color: balance > 0 ? '#E8C97A' : '#4FC999' }}>{fmt(balance)}</strong></div>
              <div className={styles.finRow}><span>Статус оплаты</span><span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>{PAY_LABEL[order.paymentStatus]}</span></div>
              {(order as any).expectedPaymentMethod && (
                <div className={styles.finRow}><span>Ожидаемый способ доплаты</span><span style={{ fontWeight: 500 }}>{(order as any).expectedPaymentMethod}</span></div>
              )}
            </div>

            {(order.payments ?? []).length > 0 && (
              <div className={styles.payHistory}>
                <div className={styles.payHistoryLabel}>История оплат</div>
                {(order.payments ?? []).map((payment) => (
                  <div key={payment.id} className={styles.payRow}>
                    <span>{fmtDatetime(payment.createdAt)}</span>
                    <span>{formatPaymentMethod(payment.method)}</span>
                    {payment.note && <span className={styles.payNote}>{payment.note}</span>}
                    <strong style={{ color: '#4FC999', marginLeft: 'auto' }}>+{fmt(payment.amount)}</strong>
                  </div>
                ))}
              </div>
            )}

            {!showPayForm ? (
              <button className={styles.addPayBtn} onClick={() => { setShowPayForm(true); setTimeout(() => setPayValue('amount', balance), 0); }}>
                <CreditCard size={13} />
                Добавить оплату
              </button>
            ) : (
              <form className={styles.payForm} onSubmit={handlePaySubmit(onPaySubmit)}>
                <div className={styles.payFormRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Сумма ₸</label>
                    {(() => {
                      const { onChange: onAmountChange, ...amountRest } = registerPay('amount');
                      return <input {...amountRest} onChange={(e) => { if (Number(e.target.value) > balance) e.target.value = String(balance); onAmountChange(e); }} type="number" min="0.01" max={balance} step="any" className={`${styles.payInput} ${payErrors.amount ? styles.payInputError : ''}`} placeholder="0" autoFocus onFocus={(e) => e.target.select()} />;
                    })()}
                    {payErrors.amount && <span className={styles.payError}>{payErrors.amount.message}</span>}
                    {!payErrors.amount && Number(payAmount) > 0 && Number(payAmount) <= balance && <span className={styles.payBalanceHint}>Остаток после оплаты: {new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(balance - Number(payAmount))} ₸</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Метод</label>
                    <select {...registerPay('method')} className={styles.payInput}>{Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </div>
                </div>
                <input {...registerPay('note')} className={styles.payInput} placeholder="Примечание (необязательно)" />
                <div className={styles.payFormActions}>
                  <button type="submit" className={styles.paySubmit} disabled={addPayment.isPending}>{addPayment.isPending ? 'Сохранение...' : 'Сохранить'}</button>
                  <button type="button" className={styles.payCancel} onClick={() => setShowPayForm(false)}>Отмена</button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Действия</div>
            <div className={styles.actions}>
              {!['completed', 'cancelled'].includes(order.status) && (
                <button className={`${styles.actionBtn} ${styles.actionEdit}`} onClick={() => navigate(`/workzone/chapan/orders/${order.id}/edit`)}>
                  <Pencil size={13} />
                  Редактировать заказ
                </button>
              )}

              {order.status === 'new' && (
                <>
                  {warehouseItems.length > 0 && productionItems.length > 0 ? (
                    <button
                      className={`${styles.actionBtn} ${styles.actionPrimary}`}
                      onClick={() => confirmOrder.mutate(order.id, {
                        onSuccess: () => { setSelectedOrderId(null); navigate('/workzone/chapan/orders'); },
                      })}
                      disabled={confirmOrder.isPending}
                    >
                      <Package size={14} />
                      {confirmOrder.isPending ? 'Отправка...' : 'Подтвердить маршрут'}
                    </button>
                  ) : allInStock ? (
                    <button
                      className={`${styles.actionBtn} ${styles.actionSecondary}`}
                      onClick={() => fulfillFromStock.mutate(order.id, {
                        onSuccess: () => { setSelectedOrderId(null); navigate('/workzone/chapan/ready'); },
                      })}
                      disabled={fulfillFromStock.isPending}
                    >
                      <Package size={14} />
                      {fulfillFromStock.isPending ? 'Перевод...' : 'Перевести в Готово'}
                    </button>
                  ) : (
                    <button
                      className={`${styles.actionBtn} ${styles.actionPrimary}`}
                      onClick={() => confirmOrder.mutate(order.id, {
                        onSuccess: () => { setSelectedOrderId(null); navigate('/workzone/chapan/orders'); },
                      })}
                      disabled={confirmOrder.isPending}
                    >
                      <Package size={14} />
                      {confirmOrder.isPending ? 'Отправка...' : 'Отправить в цех'}
                    </button>
                  )}
                </>
              )}

              {['ready', 'transferred', 'on_warehouse', 'completed'].includes(order.status) && (
                <button className={`${styles.actionBtn} ${styles.actionSecondary}`} onClick={handleInvoiceDownload} disabled={invoiceDownloading}>
                  <Download size={13} />
                  {invoiceDownloading ? 'Подготовка накладной...' : 'Скачать накладную'}
                </button>
              )}

              {order.status === 'ready' && (
                pendingInvoice ? (
                  <div className={styles.invoicePanel}>
                    <div className={styles.invoicePanelTitle}>
                      <Clock size={12} />
                      Накладная <span className={styles.invoicePanelNum}>#{pendingInvoice.invoiceNumber}</span> ожидает подтверждения
                    </div>
                    <div className={styles.invoiceConfirms}>
                      <span className={`${styles.invoiceChip} ${pendingInvoice.seamstressConfirmed ? styles.invoiceChipDone : ''}`}>
                        {pendingInvoice.seamstressConfirmed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        Швея
                      </span>
                      <span className={`${styles.invoiceChip} ${pendingInvoice.warehouseConfirmed ? styles.invoiceChipDone : ''}`}>
                        {pendingInvoice.warehouseConfirmed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        Склад
                      </span>
                    </div>
                    {!pendingInvoice.seamstressConfirmed && (
                      <button
                        className={styles.invoiceConfirmBtn}
                        onClick={() => confirmSeamstress.mutate(pendingInvoice.id)}
                        disabled={confirmSeamstress.isPending}
                      >
                        <CheckCircle2 size={13} />
                        {confirmSeamstress.isPending ? 'Подтверждение...' : 'Подтвердить отправку'}
                      </button>
                    )}
                    <div className={styles.invoicePanelHint}>
                      Заказ перейдёт на склад после двустороннего подтверждения
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      className={`${styles.actionBtn} ${styles.actionSecondary}`}
                      onClick={() => void handleTransferToWarehouse()}
                      disabled={createInvoice.isPending || changeStatus.isPending}
                    >
                      {createInvoice.isPending ? 'Создание накладной...' : 'На склад'}
                    </button>
                    <div
                      className={`${styles.invoiceToggle} ${order.requiresInvoice ? styles.invoiceToggleOn : ''}`}
                      onClick={() => { if (!setRequiresInvoice.isPending) setRequiresInvoice.mutate({ id: order.id, requiresInvoice: !order.requiresInvoice }); }}
                      style={{ opacity: setRequiresInvoice.isPending ? 0.6 : 1 }}
                      role="switch"
                      aria-checked={order.requiresInvoice}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!setRequiresInvoice.isPending) setRequiresInvoice.mutate({ id: order.id, requiresInvoice: !order.requiresInvoice }); } }}
                    >
                      <div className={`${styles.invoiceToggleIcon} ${order.requiresInvoice ? styles.invoiceToggleIconOn : ''}`}>
                        <FileText size={13} />
                      </div>
                      <div className={styles.invoiceToggleContent}>
                        <div className={styles.invoiceToggleLabel}>Прикрепить накладную</div>
                        <div className={styles.invoiceToggleDesc}>Создать при отправке на склад</div>
                      </div>
                      <div className={`${styles.toggleTrack} ${order.requiresInvoice ? styles.toggleTrackOn : ''}`}>
                        <div className={styles.toggleKnob} />
                      </div>
                    </div>
                  </div>
                )
              )}
              {order.status === 'transferred' && <button className={`${styles.actionBtn} ${styles.actionSecondary}`} onClick={() => changeStatus.mutate({ id: order.id, status: 'completed' })} disabled={changeStatus.isPending}>Завершить заказ</button>}

              {['ready', 'transferred', 'on_warehouse', 'completed'].includes(order.status) && !order.isArchived && (
                <button
                  className={`${styles.actionBtn} ${styles.actionArchive}`}
                  onClick={() => {
                    if (order.paymentStatus !== 'paid') setCloseUnpaidWarning(true);
                    else closeOrder.mutate(order.id);
                  }}
                  disabled={closeOrder.isPending}
                >
                  <ArchiveIcon size={13} />
                  {closeOrder.isPending ? 'Закрытие...' : 'Закрыть сделку'}
                </button>
              )}

              {!['completed', 'cancelled'].includes(order.status) && <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => setCancelConfirmOpen(true)} disabled={changeStatus.isPending}>Отменить заказ</button>}

              {order.status === 'completed' && (
                <>
                  <div className={styles.completedBadge}>Заказ завершён</div>
                  {order.isArchived && <div className={styles.archivedBadge}>В архиве</div>}
                </>
              )}

              {(order.status === 'cancelled' || (order.isArchived && order.status !== 'completed')) && (
                <>
                  <div className={styles.cancelledBadge}>{order.status === 'cancelled' ? 'Заказ отменён' : 'Заказ в архиве'}</div>
                  <button className={`${styles.actionBtn} ${styles.actionSecondary}`} onClick={() => setRestorePromptOpen(true)} disabled={restoreOrder.isPending}>
                    <RotateCcw size={13} />
                    {restoreOrder.isPending ? 'Восстановление...' : 'Восстановить заказ'}
                  </button>
                </>
              )}
            </div>
          </div>

          {warehouseItems.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>Склад</div>
              <div className={styles.routeList}>
                {warehouseItems.map((item) => (
                  <div key={item.id} className={styles.routeListItem}>
                    <div className={styles.routeListInfo}>
                      <span className={styles.routeListName}>{item.productName}</span>
                      <span className={styles.routeListMeta}>{formatItemMeta(item)}</span>
                    </div>
                    <span className={`${styles.routeStatus} ${styles.routeStatusWarehouse}`}>{['on_warehouse', 'shipped', 'completed'].includes(order.status) ? 'На складе' : 'К отправке'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {productionItems.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>Производство</div>
              <div className={styles.prodList}>
                {productionItems.map((item) => {
                  const task = productionTaskByItemId.get(item.id);
                  return (
                    <div key={item.id} className={`${styles.prodTask} ${task?.isBlocked ? styles.prodTaskBlocked : ''}`}>
                      <div className={styles.prodTaskLeft}>
                        <span className={styles.prodTaskName}>{item.productName}</span>
                        <span className={styles.prodTaskMeta}>{formatItemMeta(item)}</span>
                        {task?.assignedTo && <span className={styles.prodTaskWorker}>Исполнитель: {task.assignedTo}</span>}
                        {task?.isBlocked && task.blockReason && <span className={styles.prodTaskBlock}>Блок: {task.blockReason}</span>}
                      </div>
                      <span className={`${styles.prodStatus} ${task?.status === 'done' ? styles.prodStatusDone : ''}`}>{task ? (PROD_STATUS_LABEL[task.status] ?? task.status) : 'Очередь'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardLabel}>История</div>
            <div className={styles.activityList}>
              {(order.activities ?? []).length === 0 && <div className={styles.noActivity}>Нет записей</div>}
              {(order.activities ?? []).map((activity) => (
                <div key={activity.id} className={styles.actItem}>
                  <div className={styles.actMeta}>
                    <span className={styles.actAuthor}>{activity.authorName}</span>
                    <span className={styles.actDate}>{fmtDatetime(activity.createdAt)}</span>
                  </div>
                  {activity.content && <div className={styles.actContent}>{activity.content}</div>}
                </div>
              ))}
            </div>

            <div className={styles.commentBox}>
              <input
                className={styles.commentInput}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Добавить комментарий..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleComment();
                  }
                }}
              />
              <button className={styles.commentBtn} onClick={() => void handleComment()} disabled={!comment.trim() || submittingComment}>
                <MessageSquare size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {cancelConfirmOpen && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="cancel-title" onClick={() => setCancelConfirmOpen(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle} id="cancel-title">Отменить заказ?</div>
            <div className={styles.confirmText}>Заказ #{order.orderNumber} будет переведён в статус «Отменён». Это действие можно отменить через «Восстановить заказ».</div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmSecondary} onClick={() => setCancelConfirmOpen(false)}>Не отменять</button>
              <button type="button" className={styles.confirmDanger} onClick={() => { setCancelConfirmOpen(false); changeStatus.mutate({ id: order.id, status: 'cancelled' }); }} disabled={changeStatus.isPending}>Да, отменить</button>
            </div>
          </div>
        </div>
      )}

      {restorePromptOpen && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="restore-title">
          <div className={styles.confirmDialog}>
            <div className={styles.confirmTitle} id="restore-title">{order.status === 'cancelled' ? 'Восстановить заказ?' : 'Убрать заказ из архива?'}</div>
            <div className={styles.confirmText}>{order.status === 'cancelled' ? 'Заказ вернётся в статус "Новый".' : 'Заказ снова станет обычным активным заказом.'}</div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmSecondary} onClick={() => setRestorePromptOpen(false)}>Отмена</button>
              <button type="button" className={styles.confirmPrimary} onClick={() => { setRestorePromptOpen(false); restoreOrder.mutate({ id: order.id, status: order.status }); }} disabled={restoreOrder.isPending}>Восстановить</button>
            </div>
          </div>
        </div>
      )}

      {closeUnpaidWarning && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="close-unpaid-title" onClick={() => setCloseUnpaidWarning(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle} id="close-unpaid-title">Заказ не полностью оплачен</div>
            <div className={styles.confirmText}>Остаток по заказу #{order.orderNumber}: <strong>{fmt(balance)}</strong>.{order.paymentStatus === 'not_paid' ? ' Оплата не поступала.' : ' Оплата поступила частично.'} Вы уверены, что хотите закрыть сделку?</div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmSecondary} onClick={() => setCloseUnpaidWarning(false)}>Отмена</button>
              <button type="button" className={styles.confirmDanger} onClick={() => { setCloseUnpaidWarning(false); closeOrder.mutate(order.id); }} disabled={closeOrder.isPending}>Закрыть всё равно</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

