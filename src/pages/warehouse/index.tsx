import { useState, useDeferredValue } from 'react';
import { Plus, Search, Package, TrendingDown, AlertTriangle, Download, PackageCheck, Send, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  useWarehouseItems, useWarehouseMovements, useWarehouseAlerts,
  useWarehouseCategories, useCreateItem, useAddMovement, useDeleteItem, useResolveAlert,
} from '../../entities/warehouse/queries';
import {
  useInvoices, useConfirmWarehouse, useOrders, useShipOrder,
} from '../../entities/order/queries';
import type { WarehouseItem, MovementType, CreateItemDto, AddMovementDto } from '../../entities/warehouse/types';
import type { ChapanOrder, ChapanInvoice } from '../../entities/order/types';
import { getStockStatus } from '../../entities/warehouse/types';
import { Skeleton } from '../../shared/ui/Skeleton';
import { exportToCSV } from '../../shared/lib/export';
import styles from './Warehouse.module.css';

type Tab = 'incoming' | 'orders_wh' | 'to_ship' | 'items' | 'movements' | 'alerts';

const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: 'Приход', out: 'Расход', adjustment: 'Корректировка', write_off: 'Списание', return: 'Возврат',
};
const MOVEMENT_COLOR: Record<MovementType, string> = {
  in: 'var(--fill-positive)', out: 'var(--fill-negative)', adjustment: 'var(--fill-warning)',
  write_off: 'var(--fill-negative)', return: 'var(--fill-info)',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtNum(n: number) {
  return new Intl.NumberFormat('ru-KZ').format(n);
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
  const [form, setForm] = useState<AddMovementDto>({
    itemId: preselectItemId ?? '',
    type: 'in',
    qty: 1,
    reason: '',
  });

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

// ── Main Page ────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен', partial: 'Частично', paid: 'Оплачен',
};
const PAY_COLOR: Record<string, string> = {
  not_paid: 'var(--fill-negative)', partial: 'var(--fill-warning)', paid: 'var(--fill-positive)',
};

export default function WarehousePage() {
  const [tab, setTab] = useState<Tab>('items');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addMovOpen, setAddMovOpen] = useState(false);
  const [preselectItem, setPreselectItem] = useState<string | undefined>();

  // Warehouse inventory data
  const { data: itemsData, isLoading: itemsLoading } = useWarehouseItems({ search: deferredSearch || undefined });
  const { data: movData, isLoading: movLoading } = useWarehouseMovements({ limit: 100 });
  const { data: alertsData } = useWarehouseAlerts();
  const deleteItem = useDeleteItem();
  const resolveAlert = useResolveAlert();

  // Chapan order handoff data
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ status: 'pending_confirmation', limit: 200 });
  const pendingInvoices = (invoicesData?.results ?? []).filter((inv) => !inv.warehouseConfirmed);
  const { data: whOrdersData, isLoading: whOrdersLoading } = useOrders({ status: 'on_warehouse', limit: 200 });
  const warehouseOrders: ChapanOrder[] = whOrdersData?.results ?? [];
  const toShipOrders = warehouseOrders.filter((o) => o.paymentStatus === 'paid');
  const unpaidOrders = warehouseOrders.filter((o) => o.paymentStatus !== 'paid');

  const confirmWarehouse = useConfirmWarehouse();
  const shipOrder = useShipOrder();

  const items = itemsData?.results ?? [];
  const movements = movData?.results ?? [];
  const alerts = alertsData?.results ?? [];

  const alertCount = alerts.length;
  const incomingCount = pendingInvoices.length;

  function handleExportItems() {
    exportToCSV(items.map(i => ({
      'Название': i.name,
      'Уникальный номер': i.sku ?? '',
      'Ед.изм': i.unit,
      'Остаток': i.qty,
      'Мин.остаток': i.qtyMin,
      'Категория': i.category?.name ?? '',
      'Цена закупки': i.costPrice ?? '',
    })), 'склад_остатки.csv');
  }

  function handleExportMovements() {
    exportToCSV(movements.map(m => ({
      'Дата': fmtDate(m.createdAt),
      'Тип': MOVEMENT_LABEL[m.type],
      'Позиция': m.item?.name ?? m.itemId,
      'Количество': m.qty,
      'Причина': m.reason ?? '',
      'Автор': m.author,
    })), 'склад_движения.csv');
  }

  const totalUnits = items.reduce((sum, i) => sum + i.qty, 0);

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
            <button className={`${styles.tab} ${tab === 'orders_wh' ? styles.tabActive : ''}`} onClick={() => setTab('orders_wh')}>
              <Package size={13} /> Заказы {warehouseOrders.length > 0 && <span className={styles.alertBadge}>{warehouseOrders.length}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'to_ship' ? styles.tabActive : ''}`} onClick={() => setTab('to_ship')}>
              <Send size={13} /> К отправке
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats — always visible */}
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

      {/* ── Incoming invoices tab ── */}
      {tab === 'incoming' && (
        invoicesLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_,i) => <Skeleton key={i} height={56} radius={8} />)}</div>
        ) : pendingInvoices.length === 0 ? (
          <div className={styles.empty}>
            <PackageCheck size={32} className={styles.emptyIcon} />
            <p>Нет входящих накладных</p>
            <span className={styles.emptyNote}>Когда контролёр передаст заказы на склад, накладные появятся здесь</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Накладная</th><th>Дата</th><th>Заказов</th><th>Создал</th><th></th></tr></thead>
              <tbody>
                {pendingInvoices.map((inv) => (
                  <tr key={inv.id} className={styles.row}>
                    <td className={styles.tdName}>#{inv.invoiceNumber}</td>
                    <td className={styles.tdDate}>{fmtDate(inv.createdAt)}</td>
                    <td className={styles.tdNum}>{inv.items?.length ?? 0}</td>
                    <td className={styles.tdSecondary}>{inv.createdByName}</td>
                    <td className={styles.tdActions}>
                      <button
                        className={styles.incomBtn}
                        onClick={() => confirmWarehouse.mutate(inv.id)}
                        disabled={confirmWarehouse.isPending}
                      >
                        <PackageCheck size={12} /> {confirmWarehouse.isPending ? 'Подтверждение...' : 'Принять'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Orders on warehouse tab ── */}
      {tab === 'orders_wh' && (
        whOrdersLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_,i) => <Skeleton key={i} height={52} radius={8} />)}</div>
        ) : warehouseOrders.length === 0 ? (
          <div className={styles.empty}>
            <Package size={32} className={styles.emptyIcon} />
            <p>Склад пуст</p>
            <span className={styles.emptyNote}>Принятые заказы появятся после подтверждения накладных</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Заказ</th><th>Клиент</th><th>Модель</th><th>Сумма</th><th>Оплата</th><th></th></tr></thead>
              <tbody>
                {warehouseOrders.map((order) => (
                  <tr key={order.id} className={styles.row}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary}>{order.items?.[0]?.productName ?? '—'}</td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td>
                      <span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>
                        {PAY_LABEL[order.paymentStatus]}
                      </span>
                    </td>
                    <td className={styles.tdActions}>
                      {order.paymentStatus === 'paid' ? (
                        <button
                          className={styles.incomBtn}
                          onClick={() => shipOrder.mutate(order.id)}
                          disabled={shipOrder.isPending}
                        >
                          <Send size={12} /> Отправить
                        </button>
                      ) : (
                        <span style={{ color: 'var(--fill-warning)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> Не оплачен
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── To ship tab ── */}
      {tab === 'to_ship' && (
        whOrdersLoading ? (
          <div className={styles.skeletons}>{[...Array(4)].map((_,i) => <Skeleton key={i} height={52} radius={8} />)}</div>
        ) : toShipOrders.length === 0 && unpaidOrders.length === 0 ? (
          <div className={styles.empty}>
            <Send size={32} className={styles.emptyIcon} />
            <p>Нет заказов к отправке</p>
            <span className={styles.emptyNote}>Оплаченные заказы со склада будут готовы к отгрузке</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Заказ</th><th>Клиент</th><th>Модель</th><th>Сумма</th><th>Оплата</th><th></th></tr></thead>
              <tbody>
                {toShipOrders.map((order) => (
                  <tr key={order.id} className={styles.row}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary}>{order.items?.[0]?.productName ?? '—'}</td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td><span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>{PAY_LABEL[order.paymentStatus]}</span></td>
                    <td className={styles.tdActions}>
                      <button
                        className={styles.incomBtn}
                        onClick={() => shipOrder.mutate(order.id)}
                        disabled={shipOrder.isPending}
                      >
                        <Send size={12} /> Отправить
                      </button>
                    </td>
                  </tr>
                ))}
                {unpaidOrders.map((order) => (
                  <tr key={order.id} className={styles.row}>
                    <td className={styles.tdMono}>#{order.orderNumber}</td>
                    <td className={styles.tdName}>{order.clientName}</td>
                    <td className={styles.tdSecondary}>{order.items?.[0]?.productName ?? '—'}</td>
                    <td className={styles.tdNum}>{fmtMoney(order.totalAmount)}</td>
                    <td><span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>{PAY_LABEL[order.paymentStatus]}</span></td>
                    <td className={styles.tdActions}>
                      <span style={{ color: 'var(--fill-negative)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} /> Не оплачен
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Items tab ── */}
      {tab === 'items' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={13} className={styles.searchIcon} />
              <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию или позиций в базе" />
            </div>
            <button className={styles.exportBtn} onClick={handleExportItems}><Download size={13} /> Excel</button>
            <button className={styles.addBtn} onClick={() => setAddItemOpen(true)}><Plus size={14} /> Добавить</button>
          </div>

          {itemsLoading ? (
            <div className={styles.skeletons}>{[...Array(6)].map((_,i) => <Skeleton key={i} height={52} radius={8} />)}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Название</th><th>Уникальный номер</th><th>Кат.</th><th>Остаток</th><th>Мин.</th><th>Статус</th><th></th>
                  </tr>
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

      {/* ── Movements tab ── */}
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
            <div className={styles.skeletons}>{[...Array(8)].map((_,i) => <Skeleton key={i} height={48} radius={8} />)}</div>
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

      {/* ── Alerts tab ── */}
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
    </div>
  );
}
