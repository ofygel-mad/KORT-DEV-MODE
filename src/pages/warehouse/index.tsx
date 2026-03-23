import { useState, useDeferredValue } from 'react';
import { Plus, Search, Package, TrendingDown, AlertTriangle, Download } from 'lucide-react';
import {
  useWarehouseItems, useWarehouseMovements, useWarehouseAlerts,
  useWarehouseCategories, useCreateItem, useAddMovement, useDeleteItem, useResolveAlert,
} from '../../entities/warehouse/queries';
import type { WarehouseItem, MovementType, CreateItemDto, AddMovementDto } from '../../entities/warehouse/types';
import { getStockStatus } from '../../entities/warehouse/types';
import { Skeleton } from '../../shared/ui/Skeleton';
import { exportToCSV } from '../../shared/lib/export';
import styles from './Warehouse.module.css';

type Tab = 'items' | 'movements' | 'alerts';

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
          <button className={styles.drawerClose} onClick={onClose}>✕</button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Название <span className={styles.req}>*</span></label>
            <input className={styles.input} value={form.name} onChange={sf('name')} placeholder="Шерсть кашемир" required autoFocus />
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>SKU</label>
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
              <input className={styles.input} type="number" min="0" value={form.qty ?? 0} onChange={sf('qty')} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Минимум (алерт)</label>
              <input className={styles.input} type="number" min="0" value={form.qtyMin ?? 0} onChange={sf('qtyMin')} />
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
          <button className={styles.drawerClose} onClick={onClose}>✕</button>
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
              <input className={styles.input} type="number" min="0.01" step="any" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: parseFloat(e.target.value) || 0 }))} required />
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

export default function WarehousePage() {
  const [tab, setTab] = useState<Tab>('items');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addMovOpen, setAddMovOpen] = useState(false);
  const [preselectItem, setPreselectItem] = useState<string | undefined>();

  const { data: itemsData, isLoading: itemsLoading } = useWarehouseItems({ search: deferredSearch || undefined });
  const { data: movData, isLoading: movLoading } = useWarehouseMovements({ limit: 100 });
  const { data: alertsData } = useWarehouseAlerts();
  const deleteItem = useDeleteItem();
  const resolveAlert = useResolveAlert();

  const items = itemsData?.results ?? [];
  const movements = movData?.results ?? [];
  const alerts = alertsData?.results ?? [];

  const alertCount = alerts.length;

  function handleExportItems() {
    exportToCSV(items.map(i => ({
      'Название': i.name,
      'SKU': i.sku ?? '',
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

  return (
    <div className={styles.root}>
      {/* Tabs */}
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
              <AlertTriangle size={13} /> Алерты {alertCount > 0 && <span className={styles.alertBadge}>{alertCount}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Items tab ── */}
      {tab === 'items' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={13} className={styles.searchIcon} />
              <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию, SKU..." />
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
                    <th>Название</th><th>SKU</th><th>Кат.</th><th>Остаток</th><th>Мин.</th><th>Статус</th><th></th>
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
                            {status === 'ok' ? '✓ Норма' : status === 'low' ? '⚠ Мало' : '❗ Критично'}
                          </span>
                        </td>
                        <td className={styles.tdActions}>
                          <button className={styles.incomBtn} onClick={() => { setPreselectItem(item.id); setAddMovOpen(true); }}>Приход</button>
                          <button className={styles.deleteBtn} onClick={() => { if (confirm('Удалить позицию?')) deleteItem.mutate(item.id); }}>✕</button>
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
                  <td><span className={styles.alertStatusBadge}>⚠ Низкий остаток</span></td>
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
              <span className={styles.emptyNote}>Алерты появятся когда остаток упадёт ниже минимума</span>
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
