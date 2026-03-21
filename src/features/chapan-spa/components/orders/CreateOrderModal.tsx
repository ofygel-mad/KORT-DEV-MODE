import { useEffect, useState, Fragment } from 'react';
import { X, Plus, Trash2, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useChapanStore } from '../../model/chapan.store';
import { useTileChapanUI } from '../../model/tile-ui.store';
import type { OrderItem, OrderPriority, PaymentMethod } from '../../api/types';
import {
  PRODUCT_CATALOG, FABRIC_CATALOG, SIZE_OPTIONS, PRIORITY_LABEL, PAYMENT_METHOD_LABEL,
} from '../../api/types';
import s from './CreateOrderModal.module.css';

interface Props {
  tileId: string;
}

interface DraftItem {
  key: number;
  productName: string;
  fabric: string;
  size: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  workshopNotes: string;
}

let _key = 0;
function emptyItem(
  productCatalog: readonly string[],
  fabricCatalog: readonly string[],
  sizeCatalog: readonly string[],
): DraftItem {
  return {
    key: ++_key,
    productName: productCatalog[0] ?? PRODUCT_CATALOG[0],
    fabric: fabricCatalog[0] ?? FABRIC_CATALOG[0],
    size: sizeCatalog[3] ?? sizeCatalog[0] ?? SIZE_OPTIONS[0],
    quantity: 1,
    unitPrice: 0,
    notes: '',
    workshopNotes: '',
  };
}

export function CreateOrderModal({ tileId }: Props) {
  const {
    createModalOpen,
    createPrefill,
    closeCreateModal,
    clearCreatePrefill,
  } = useTileChapanUI(tileId);
  const {
    clients,
    createOrder,
    addPayment,
    productCatalog,
    fabricCatalog,
    sizeCatalog,
  } = useChapanStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Client
  const [clientId, setClientId]       = useState('');
  const [clientName, setClientName]   = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // Step 2: Order params + items
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [dueDate, setDueDate]   = useState('');
  const [items, setItems]       = useState<DraftItem[]>([
    emptyItem(PRODUCT_CATALOG, FABRIC_CATALOG, SIZE_OPTIONS),
  ]);

  // Step 3: Advance payment
  const [advance, setAdvance]             = useState<number>(0);
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('cash');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!createModalOpen) return;

    const draftItem = () => emptyItem(productCatalog, fabricCatalog, sizeCatalog);

    if (createPrefill) {
      setStep(1);
      setClientId('');
      setClientName(createPrefill.clientName ?? '');
      setClientPhone(createPrefill.clientPhone ?? '');
      setPriority(createPrefill.priority ?? 'normal');
      setDueDate(createPrefill.dueDate ?? '');
      setItems(
        createPrefill.items.length
          ? createPrefill.items.map((item) => {
              const base = draftItem();
              return {
                ...base,
                productName: item.productName ?? base.productName,
                fabric: item.fabric ?? base.fabric,
                size: item.size ?? base.size,
                quantity: item.quantity ?? 1,
                workshopNotes: item.workshopNotes ?? '',
              };
            })
          : [draftItem()],
      );
      setAdvance(0);
      setAdvanceMethod('cash');
      return;
    }

    setStep(1);
    setClientId('');
    setClientName('');
    setClientPhone('');
    setPriority('normal');
    setDueDate('');
    setItems([draftItem()]);
    setAdvance(0);
    setAdvanceMethod('cash');
  }, [createModalOpen, createPrefill, fabricCatalog, productCatalog, sizeCatalog]);

  if (!createModalOpen) return null;

  const handleClose = () => {
    closeCreateModal();
    clearCreatePrefill();
    setStep(1);
    setClientId(''); setClientName(''); setClientPhone('');
    setPriority('normal'); setDueDate('');
    setItems([emptyItem(productCatalog, fabricCatalog, sizeCatalog)]);
    setAdvance(0); setAdvanceMethod('cash');
  };

  const handleClientSelect = (id: string) => {
    setClientId(id);
    const c = clients.find(c => c.id === id);
    if (c) { setClientName(c.fullName); setClientPhone(c.phone); }
    else    { setClientName(''); setClientPhone(''); }
  };

  const updateItem = (key: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));
  };

  const removeItem = (key: number) => {
    setItems(prev => prev.filter(i => i.key !== key));
  };

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // Validation
  const isNewClient = !clientId;
  const canStep1 = clientName.trim().length > 0 && clientPhone.trim().length > 0;
  const itemErrors = items.map(i => i.unitPrice <= 0);
  const canStep2 = items.length > 0 && itemErrors.every(e => !e);
  const footerHint = step === 1 && !canStep1
    ? 'Для перехода дальше заполните имя и телефон клиента.'
    : step === 2 && !canStep2
      ? 'Для перехода дальше укажите цену для каждого изделия.'
      : '';

  const handleSave = async () => {
    if (!canStep1 || !canStep2 || saving) return;
    setSaving(true);
    const orderId = await createOrder({
      clientId: clientId || undefined,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      priority,
      items: items.map(({ productName, fabric, size, quantity, unitPrice, notes, workshopNotes }) => ({
        productName, fabric, size, quantity, unitPrice,
        notes: notes || undefined,
        workshopNotes: workshopNotes || undefined,
      })),
      dueDate: dueDate || undefined,
      sourceRequestId: createPrefill?.sourceRequestId,
    });
    if (advance > 0) {
      await addPayment(orderId, advance, advanceMethod);
    }
    setSaving(false);
    handleClose();
  };

  // ── Stepper indicator ──
  const Stepper = () => (
    <div className={s.stepper}>
      {([1, 2, 3] as const).map((n, i) => (
        <Fragment key={n}>
          <div
            className={`${s.stepItem} ${step >= n ? s.stepActive : ''} ${step > n ? s.stepDone : ''}`}
          >
            <div className={s.stepNum}>{n}</div>
            <span className={s.stepLabel}>
              {n === 1 ? 'Клиент' : n === 2 ? 'Изделия' : 'Оплата'}
            </span>
          </div>
          {i < 2 && <div className={`${s.stepLine} ${step > n ? s.stepLineDone : ''}`} />}
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className={s.overlay} onClick={handleClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={s.header}>
          <span className={s.title}>Новый заказ</span>
          <button className={s.closeBtn} onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        {/* Stepper */}
        <Stepper />

        <div className={s.body}>

          {/* ── Step 1: Client ── */}
          {step === 1 && (
            <div className={s.section}>
              <div className={s.sectionLabel}>Клиент</div>
              <select
                className={s.select}
                value={clientId}
                onChange={e => handleClientSelect(e.target.value)}
              >
                <option value="">Новый клиент</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
              <div className={s.row}>
                <input
                  className={s.input}
                  placeholder="ФИО клиента *"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  readOnly={!!clientId}
                />
                <input
                  className={s.input}
                  placeholder="+7 7XX XXX XXXX *"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  readOnly={!!clientId}
                />
              </div>
              {isNewClient && clientName.trim() && (
                <div className={s.saveClientNote}>
                  Новый клиент будет сохранён в базу
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Items + order params ── */}
          {step === 2 && (
            <>
              <div className={s.section}>
                <div className={s.sectionLabel}>Параметры заказа</div>
                <div className={s.row}>
                  <div className={s.dateWrapper}>
                    <span className={s.fieldLabel}>Приоритет</span>
                    <select
                      className={s.select}
                      value={priority}
                      onChange={e => setPriority(e.target.value as OrderPriority)}
                    >
                      {(Object.keys(PRIORITY_LABEL) as OrderPriority[]).map(p => (
                        <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.dateWrapper}>
                    <span className={s.fieldLabel}>Срок сдачи</span>
                    <input
                      className={s.input}
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                    />
                    {!dueDate && (
                      <span className={s.fieldHelper}>Рекомендуется указать, чтобы избежать просрочки</span>
                    )}
                  </div>
                </div>
              </div>
              <div className={s.section}>
                <div className={s.sectionLabel}>Изделия</div>
                {items.map((item, idx) => (
                  <div key={item.key} className={s.itemCard}>
                    <div className={s.itemHeader}>
                      <span className={s.itemIdx}>#{idx + 1}</span>
                      {items.length > 1 && (
                        <button className={s.removeBtn} onClick={() => removeItem(item.key)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className={s.row}>
                      <input
                        className={s.input}
                        list={`chapan-products-${tileId}`}
                        value={item.productName}
                        placeholder="Изделие"
                        onChange={e => updateItem(item.key, { productName: e.target.value })}
                      />
                      <input
                        className={s.input}
                        list={`chapan-fabrics-${tileId}`}
                        value={item.fabric}
                        placeholder="Ткань / материал"
                        onChange={e => updateItem(item.key, { fabric: e.target.value })}
                      />
                    </div>
                    <div className={s.row}>
                      <input
                        className={s.input}
                        list={`chapan-sizes-${tileId}`}
                        value={item.size}
                        placeholder="Размер / вариант"
                        onChange={e => updateItem(item.key, { size: e.target.value })}
                      />
                      <input
                        className={s.input}
                        type="number"
                        min={1}
                        placeholder="Кол-во"
                        value={item.quantity}
                        onChange={e => updateItem(item.key, { quantity: Math.max(1, +e.target.value) })}
                      />
                      <input
                        className={`${s.input} ${itemErrors[idx] ? s.inputError : ''}`}
                        type="number"
                        min={0}
                        placeholder="Цена ₸ *"
                        value={item.unitPrice || ''}
                        onChange={e => updateItem(item.key, { unitPrice: Math.max(0, +e.target.value) })}
                      />
                    </div>
                    {itemErrors[idx] && (
                      <div className={s.itemError}>Укажите цену изделия</div>
                    )}
                    {/* Workshop notes */}
                    <input
                      className={`${s.input} ${s.notesInput}`}
                      placeholder="Примечание для цеха (особый крой, вышивка, нестандарт...)"
                      value={item.workshopNotes}
                      onChange={e => updateItem(item.key, { workshopNotes: e.target.value })}
                    />
                  </div>
                ))}
                <datalist id={`chapan-products-${tileId}`}>
                  {productCatalog.map(product => <option key={product} value={product} />)}
                </datalist>
                <datalist id={`chapan-fabrics-${tileId}`}>
                  {fabricCatalog.map(fabric => <option key={fabric} value={fabric} />)}
                </datalist>
                <datalist id={`chapan-sizes-${tileId}`}>
                  {sizeCatalog.map(size => <option key={size} value={size} />)}
                </datalist>
                <button
                  className={s.addItemBtn}
                  onClick={() => setItems(prev => [...prev, emptyItem(productCatalog, fabricCatalog, sizeCatalog)])}
                >
                  <Plus size={13} />
                  Добавить изделие
                </button>
                {total > 0 && (
                  <div className={s.totalRow}>
                    Итого: <strong>{total.toLocaleString('ru-RU')} ₸</strong>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Step 3: Advance payment + summary ── */}
          {step === 3 && (
            <>
              <div className={s.summaryCcard}>
                <div className={s.summaryClient}>
                  <span className={s.summaryName}>{clientName}</span>
                  <span className={s.summaryPhone}>{clientPhone}</span>
                </div>
                <div className={s.summaryMeta}>
                  {items.length} изделий ·{' '}
                  {dueDate
                    ? `срок: ${new Date(dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
                    : <span className={s.summaryNoDue}>срок не задан</span>
                  }
                </div>
                <div className={s.summaryTotal}>
                  {total.toLocaleString('ru-RU')} ₸
                </div>
              </div>

              {!dueDate && (
                <div className={s.dueDateWarning}>
                  <AlertTriangle size={12} />
                  Срок сдачи не задан. Рекомендуется вернуться и указать его, чтобы избежать просрочки.
                </div>
              )}

              <div className={s.section}>
                <div className={s.sectionLabel}>Первый взнос (необязательно)</div>
                <div className={s.row}>
                  <input
                    className={s.input}
                    type="number"
                    min={0}
                    placeholder="Сумма ₸"
                    value={advance || ''}
                    onChange={e => setAdvance(Math.max(0, +e.target.value))}
                  />
                  <select
                    className={s.select}
                    value={advanceMethod}
                    onChange={e => setAdvanceMethod(e.target.value as PaymentMethod)}
                  >
                    {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(m => (
                      <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
                    ))}
                  </select>
                </div>
                {advance > 0 && (
                  <div className={s.advanceNote}>
                    Остаток после взноса: <strong>{(total - advance).toLocaleString('ru-RU')} ₸</strong>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={s.footer}>
          <div className={s.footerHint} aria-live="polite">
            {footerHint}
          </div>

          <div className={s.footerActions}>
            {step === 1 ? (
              <button className={s.cancelBtn} onClick={handleClose}>Отмена</button>
            ) : (
              <button className={s.cancelBtn} onClick={() => setStep(prev => (prev - 1) as 1 | 2 | 3)}>
                <ChevronLeft size={14} />
                Назад
              </button>
            )}

            {step < 3 ? (
              <button
                className={s.saveBtn}
                disabled={step === 1 ? !canStep1 : !canStep2}
                title={step === 1 && !canStep1
                  ? 'Заполните имя и телефон'
                  : step === 2 && !canStep2
                    ? 'Укажите цену для каждого изделия'
                    : undefined}
                onClick={() => setStep(prev => (prev + 1) as 1 | 2 | 3)}
              >
                Далее
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                className={s.saveBtn}
                disabled={!canStep1 || !canStep2 || saving}
                onClick={handleSave}
              >
                {saving ? 'Создание...' : 'Создать заказ'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
