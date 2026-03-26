import type { InputHTMLAttributes } from 'react';
import { useEffect, useRef, useState, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, Plus, Trash2, Calculator, AlertCircle, Paperclip, X, ImagePlus } from 'lucide-react';
import { useId } from 'react';
import { useCreateOrder, useChapanCatalogs } from '../../../../entities/order/queries';
import { useProductsAvailability } from '../../../../entities/warehouse/queries';
import type { Priority } from '../../../../entities/order/types';
import { formatPersonNameInput } from '../../../../shared/utils/person';
import { formatKazakhPhoneInput, isKazakhPhoneComplete } from '../../../../shared/utils/kz';
import styles from './ChapanNewOrder.module.css';

// ─── Payment methods ──────────────────────────────────────────────────────────
type PaymentMethodValue = 'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer' | 'mixed';

const PAYMENT_METHODS: Array<{ value: PaymentMethodValue; label: string }> = [
  { value: 'cash',           label: 'Наличные' },
  { value: 'kaspi_qr',       label: 'Kaspi QR' },
  { value: 'kaspi_terminal', label: 'Kaspi Терминал' },
  { value: 'transfer',       label: 'Перевод' },
  { value: 'mixed',          label: 'Смешанный' },
];

const MIXED_METHODS: Array<{
  key: 'mixedCash' | 'mixedKaspiQr' | 'mixedKaspiTerminal' | 'mixedTransfer';
  label: string;
}> = [
  { key: 'mixedCash',          label: 'Наличные' },
  { key: 'mixedKaspiQr',       label: 'Kaspi QR' },
  { key: 'mixedKaspiTerminal', label: 'Kaspi Терминал' },
  { key: 'mixedTransfer',      label: 'Перевод' },
];

// ─── Schemas ──────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  productName:  z.string().min(1, 'Укажите модель'),
  gender:       z.enum(['муж', 'жен', '']).optional(),
  length:       z.string().optional(),
  color:        z.string().optional(),
  size:         z.string().min(1, 'Укажите размер'),
  quantity:     z.coerce.number().int().min(1),
  unitPrice:    z.coerce.number().min(0).optional().default(0),
  itemDiscount: z.coerce.number().min(0).optional().default(0),
  workshopNotes: z.string().optional(),
});

const schema = z
  .object({
    clientName:   z.string().min(2, 'Минимум 2 символа'),
    clientPhone:  z.string()
      .min(1, 'Телефон обязателен')
      .refine((value) => isKazakhPhoneComplete(value), 'Введите номер в формате +7 (777)-777-77-77'),
    city:          z.string().optional(),
    streetAddress: z.string().optional(),
    postalCode:    z.string().optional(),
    deliveryType:  z.string().optional(),
    source:       z.string().optional(),
    priority:     z.enum(['normal', 'urgent', 'vip']),
    orderDate:    z.string(),
    dueDate:      z.string().optional(),
    totalAmount:  z.coerce.number().min(0).optional(),
    orderDiscount: z.coerce.number().min(0).optional(),
    prepayment:   z.coerce.number().min(0).optional(),
    paymentMethod: z.enum(['cash', 'kaspi_qr', 'kaspi_terminal', 'transfer', 'mixed']).optional(),
    mixedCash:          z.coerce.number().min(0).optional(),
    mixedKaspiQr:       z.coerce.number().min(0).optional(),
    mixedKaspiTerminal: z.coerce.number().min(0).optional(),
    mixedTransfer:      z.coerce.number().min(0).optional(),
    items:        z.array(itemSchema).min(1, 'Добавьте хотя бы одну позицию'),
    managerNote:  z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const finalTotal = Math.max(0, (data.totalAmount ?? 0) - (data.orderDiscount ?? 0));

    if ((data.prepayment ?? 0) > 0 && !data.paymentMethod) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите способ оплаты', path: ['paymentMethod'] });
    }

    if ((data.prepayment ?? 0) > finalTotal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Предоплата не может превышать итоговую сумму', path: ['prepayment'] });
    }

    if (data.paymentMethod === 'mixed' && (data.prepayment ?? 0) > 0) {
      const mixedSum =
        (Number(data.mixedCash) || 0) +
        (Number(data.mixedKaspiQr) || 0) +
        (Number(data.mixedKaspiTerminal) || 0) +
        (Number(data.mixedTransfer) || 0);
      if (mixedSum > 0 && Math.abs(mixedSum - (data.prepayment ?? 0)) > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Сумма разбивки должна совпадать с предоплатой', path: ['mixedCash'] });
      }
    }
  });

type FormData = z.infer<typeof schema>;

// ─── Constants ────────────────────────────────────────────────────────────────
const CITIES   = ['Алматы', 'Астана', 'Шымкент', 'Атырау', 'Актобе', 'Тараз', 'Павлодар', 'Другой город'];
const DELIVERY = ['Самовывоз', 'Курьер по городу', 'Казпочта', 'СДЭК', 'Другое'];
const SOURCES  = ['Instagram', 'WhatsApp', 'Telegram', 'Звонок', 'Рекомендация', 'Сайт', 'Другое'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseOptionalAmount(value: string) {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildPayloadItems(items: FormData['items'], orderDiscount: number) {
  const discountedLines = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = quantity * unitPrice;
    const itemDiscount = Math.min(Number(item.itemDiscount) || 0, lineTotal);
    return {
      item,
      quantity,
      lineTotal: Math.max(0, lineTotal - itemDiscount),
    };
  });

  const subtotal = discountedLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const safeOrderDiscount = Math.min(orderDiscount, subtotal);
  let remainingDiscount = safeOrderDiscount;

  return discountedLines.map((line, index) => {
    const proportionalDiscount = index === discountedLines.length - 1
      ? remainingDiscount
      : subtotal > 0
        ? safeOrderDiscount * (line.lineTotal / subtotal)
        : 0;
    const finalLineTotal = Math.max(0, line.lineTotal - proportionalDiscount);
    remainingDiscount = Math.max(0, remainingDiscount - proportionalDiscount);
    const effectiveUnitPrice = line.quantity > 0
      ? Number((finalLineTotal / line.quantity).toFixed(4))
      : 0;

    return {
      productName: line.item.productName,
      fabric: line.item.color?.trim() || undefined,
      size: line.item.size,
      quantity: line.quantity,
      unitPrice: effectiveUnitPrice,
      workshopNotes: line.item.workshopNotes || undefined,
    };
  });
}

function SelectOrText({ options, placeholder, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { options: string[] }) {
  const id = useId();
  return (
    <>
      <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
      <input {...props} list={id} placeholder={placeholder} className={className} autoComplete="off" />
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChapanNewOrderPage() {
  const navigate    = useNavigate();
  const createOrder = useCreateOrder();
  const { data: catalogs } = useChapanCatalogs();

  // File state (UI only — upload endpoint TBD)
  const [itemPhotos, setItemPhotos] = useState<Record<number, File | null>>({});
  const [receipts, setReceipts]     = useState<File[]>([]);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const {
    register, control, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority:  'normal',
      orderDate: todayIso(),
      items: [{ productName: '', gender: '', length: '', color: '', size: '', quantity: 1, unitPrice: undefined, itemDiscount: undefined, workshopNotes: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Derived values
  const items            = watch('items');
  const priority         = watch('priority');
  const deferredProductNames = useDeferredValue(
    items.map((i) => i.productName).filter(Boolean),
  );
  const { data: stockMap } = useProductsAvailability(deferredProductNames);
  const paymentMethod    = watch('paymentMethod');
  const totalAmountRaw   = watch('totalAmount');
  const orderDiscountRaw = watch('orderDiscount');
  const prepaymentRaw    = watch('prepayment');
  const mixedCash          = Number(watch('mixedCash'))          || 0;
  const mixedKaspiQr       = Number(watch('mixedKaspiQr'))       || 0;
  const mixedKaspiTerminal = Number(watch('mixedKaspiTerminal')) || 0;
  const mixedTransfer      = Number(watch('mixedTransfer'))      || 0;

  const totalAmount   = Number.isFinite(totalAmountRaw)   ? (totalAmountRaw   ?? 0) : 0;
  const orderDiscount = Number.isFinite(orderDiscountRaw) ? (orderDiscountRaw ?? 0) : 0;
  const prepayment    = Number.isFinite(prepaymentRaw)    ? (prepaymentRaw    ?? 0) : 0;
  const finalTotal    = Math.max(0, totalAmount - orderDiscount);
  const debt          = Math.max(0, finalTotal - prepayment);
  const mixedSum      = mixedCash + mixedKaspiQr + mixedKaspiTerminal + mixedTransfer;

  const itemsTotal = items.reduce((sum, item) => {
    const line = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    return sum + Math.max(0, line - (Number(item.itemDiscount) || 0));
  }, 0);

  // Автоматически подставляем итог позиций как базовую сумму заказа
  useEffect(() => {
    setValue('totalAmount', itemsTotal);
  }, [itemsTotal, setValue]);

  function fmt(n: number) {
    return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
  }

  async function onSubmit(data: FormData) {
    const hasPrepayment = (data.prepayment ?? 0) > 0;
    const isMixed = data.paymentMethod === 'mixed';
    const payloadItems = buildPayloadItems(data.items, orderDiscount);

    await createOrder.mutateAsync({
      clientName:    formatPersonNameInput(data.clientName).trim(),
      clientPhone:   formatKazakhPhoneInput(data.clientPhone),
      streetAddress: data.streetAddress?.trim() || undefined,
      postalCode:    data.postalCode || undefined,
      priority:      data.priority as Priority,
      orderDate:     data.orderDate || undefined,
      dueDate:       data.dueDate   || undefined,
      prepayment:    hasPrepayment ? data.prepayment : undefined,
      paymentMethod: hasPrepayment ? data.paymentMethod : undefined,
      mixedBreakdown: hasPrepayment && isMixed ? {
        mixedCash:          data.mixedCash          ?? 0,
        mixedKaspiQr:       data.mixedKaspiQr       ?? 0,
        mixedKaspiTerminal: data.mixedKaspiTerminal ?? 0,
        mixedTransfer:      data.mixedTransfer      ?? 0,
      } : undefined,
      receiptFileNames: receipts.length > 0 ? receipts.map((f) => f.name) : undefined,
      items: payloadItems,
      managerNote: data.managerNote?.trim() || undefined,
    });
    navigate('/workzone/chapan/orders');
  }

  const products = catalogs?.productCatalog ?? [];
  const sizes    = catalogs?.sizeCatalog    ?? [];

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <button className={styles.backLink} onClick={() => navigate('/workzone/chapan/orders')}>
          <ChevronLeft size={14} />
          <span>Заказы</span>
        </button>
        <h1 className={styles.pageTitle}>Новый заказ</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>

        {/* ── 01 Данные клиента ─────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>01</span>
            <span className={styles.sectionTitle}>Данные клиента</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>ФИО клиента <span className={styles.req}>*</span></label>
                <Controller
                  control={control}
                  name="clientName"
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(formatPersonNameInput(event.target.value))}
                      className={`${styles.input} ${errors.clientName ? styles.inputError : ''}`}
                      placeholder="Аскаров Аскар Аскарович"
                      autoFocus
                    />
                  )}
                />
                {errors.clientName && <span className={styles.fieldError}>{errors.clientName.message}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Телефон <span className={styles.req}>*</span></label>
                <Controller
                  control={control}
                  name="clientPhone"
                  render={({ field }) => (
                    <input
                      {...field}
                      type="tel"
                      inputMode="tel"
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(formatKazakhPhoneInput(event.target.value))}
                      className={`${styles.input} ${errors.clientPhone ? styles.inputError : ''}`}
                      placeholder="+7 (701)-234-56-78"
                    />
                  )}
                />
                {errors.clientPhone && <span className={styles.fieldError}>{errors.clientPhone.message}</span>}
              </div>
            </div>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>Город</label>
                <Controller control={control} name="city" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={CITIES} placeholder="Алматы" className={styles.input} />
                )} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Почтовый индекс</label>
                <input {...register('postalCode')} className={styles.input} placeholder="050000" maxLength={10} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Доставка</label>
                <Controller control={control} name="deliveryType" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={DELIVERY} placeholder="Выберите или введите" className={styles.input} />
                )} />
              </div>
            </div>
            <div className={styles.rowFull}>
              <div className={styles.field}>
                <label className={styles.label}>Адрес доставки</label>
                <input
                  {...register('streetAddress')}
                  className={styles.input}
                  placeholder="ул. Абая 10, кв. 5 / ориентир"
                />
              </div>
            </div>
            <div className={styles.rowHalf}>
              <div className={styles.field}>
                <label className={styles.label}>Источник</label>
                <Controller control={control} name="source" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={SOURCES} placeholder="Instagram, звонок..." className={styles.input} />
                )} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 Позиции заказа ─────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>02</span>
            <span className={styles.sectionTitle}>Позиции заказа</span>
          </div>
          <div className={styles.sectionBody}>
            {fields.map((field, idx) => {
              const linePrice   = (Number(items[idx]?.quantity) || 0) * (Number(items[idx]?.unitPrice) || 0);
              const lineDisc    = Number(items[idx]?.itemDiscount) || 0;
              const lineTotal   = Math.max(0, linePrice - lineDisc);
              const itemStockName = items[idx]?.productName;
              const itemStock = itemStockName && stockMap ? stockMap[itemStockName] : undefined;

              return (
                <div key={field.id} className={styles.itemCard}>
                  <div className={styles.itemCardHeader}>
                    <span className={styles.itemCardLabel}>Позиция {idx + 1}</span>
                    {fields.length > 1 && (
                      <button type="button" className={styles.itemRemoveBtn} onClick={() => remove(idx)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Модель + Размер */}
                  <div className={styles.itemRow2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Модель <span className={styles.req}>*</span></label>
                      <Controller control={control} name={`items.${idx}.productName`} render={({ field: f }) => (
                        products.length > 0 ? (
                          <select {...f} className={`${styles.select} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`}>
                            <option value="">Выберите модель</option>
                            {products.map((p) => <option key={p} value={p}>{p}</option>)}
                            <option value="__other">Другая модель...</option>
                          </select>
                        ) : (
                          <input {...f} className={`${styles.input} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`} placeholder="Назар — жуп шапан" />
                        )
                      )} />
                      {errors.items?.[idx]?.productName && <span className={styles.fieldError}>{errors.items[idx]?.productName?.message}</span>}
                      {itemStock !== undefined && (
                        <span className={itemStock.available ? styles.stockBadgeIn : styles.stockBadgeOut}>
                          {itemStock.available ? `В наличии: ${itemStock.qty} шт.` : 'Нет на складе'}
                        </span>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Размер <span className={styles.req}>*</span></label>
                      <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => (
                        sizes.length > 0 ? (
                          <select {...f} className={`${styles.select} ${errors.items?.[idx]?.size ? styles.inputError : ''}`}>
                            <option value="">— выбрать —</option>
                            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <input {...f} className={`${styles.input} ${errors.items?.[idx]?.size ? styles.inputError : ''}`} placeholder="48" />
                        )
                      )} />
                      {errors.items?.[idx]?.size && <span className={styles.fieldError}>{errors.items[idx]?.size?.message}</span>}
                    </div>
                  </div>

                  {/* Пол + Длина изделия */}
                  <div className={styles.itemRow2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Пол</label>
                      <Controller control={control} name={`items.${idx}.gender`} render={({ field: f }) => (
                        <div className={styles.genderBtns}>
                          {(['муж', 'жен'] as const).map((g) => (
                            <button
                              key={g}
                              type="button"
                              className={`${styles.genderBtn} ${f.value === g ? styles.genderBtnActive : ''}`}
                              onClick={() => f.onChange(f.value === g ? '' : g)}
                            >
                              {g === 'муж' ? 'Мужской' : 'Женский'}
                            </button>
                          ))}
                        </div>
                      )} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Длина изделия</label>
                      <Controller control={control} name={`items.${idx}.length`} render={({ field: f }) => (
                        <SelectOrText
                          {...f}
                          value={f.value ?? ''}
                          options={['Стандарт', 'Удлинённый', 'Укороченный']}
                          placeholder="Стандарт"
                          className={styles.input}
                        />
                      )} />
                    </div>
                  </div>

                  {/* Цвет + кол-во + цена + скидка */}
                  <div className={styles.itemRow4}>
                    <div className={styles.field}>
                      <label className={styles.label}>Цвет / материал</label>
                      <input {...register(`items.${idx}.color`)} className={styles.input} placeholder="Тёмно-синий, бордо..." />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Кол-во</label>
                      <input {...register(`items.${idx}.quantity`, { valueAsNumber: true })} type="number" min="1" className={styles.input} onWheel={(e) => e.currentTarget.blur()} onFocus={(e) => e.target.select()} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Цена за ед. (₸)</label>
                      <Controller control={control} name={`items.${idx}.unitPrice`} render={({ field: f }) => (
                        <input
                          type="number" min="0" inputMode="numeric"
                          className={styles.input}
                          placeholder="0"
                          value={f.value ?? ''}
                          onChange={(e) => f.onChange(parseOptionalAmount(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                          onFocus={(e) => e.target.select()}
                        />
                      )} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Скидка (₸)</label>
                      <Controller control={control} name={`items.${idx}.itemDiscount`} render={({ field: f }) => (
                        <input
                          type="number" min="0" inputMode="numeric"
                          className={styles.input}
                          placeholder="0"
                          value={f.value ?? ''}
                          onChange={(e) => f.onChange(parseOptionalAmount(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                          onFocus={(e) => e.target.select()}
                        />
                      )} />
                    </div>
                  </div>

                  {/* Итоговая сумма позиции */}
                  {linePrice > 0 && (
                    <div className={styles.lineTotalRow}>
                      {lineDisc > 0 ? (
                        <>
                          <span className={styles.lineTotalOld}>{fmt(linePrice)}</span>
                          <span className={styles.lineTotalArrow}>→</span>
                          <span className={styles.lineTotalFinal}>{fmt(lineTotal)}</span>
                          <span className={styles.lineTotalSave}>экономия {fmt(lineDisc)}</span>
                        </>
                      ) : (
                        <span className={styles.lineTotalFinal}>{fmt(linePrice)}</span>
                      )}
                    </div>
                  )}

                  {/* Комментарий для цеха */}
                  <div className={styles.itemNoteField}>
                    <input {...register(`items.${idx}.workshopNotes`)} className={styles.itemNoteInput} placeholder="Комментарий для цеха (необязательно)..." />
                  </div>

                  {/* Фото / эскиз */}
                  <div className={styles.itemPhotoRow}>
                    {itemPhotos[idx] ? (
                      <div className={styles.itemPhotoPreview}>
                        <img src={URL.createObjectURL(itemPhotos[idx]!)} alt="" className={styles.itemPhotoThumb} />
                        <span className={styles.itemPhotoName}>{itemPhotos[idx]!.name}</span>
                        <button type="button" className={styles.fileRemoveBtn} onClick={() => setItemPhotos((p) => ({ ...p, [idx]: null }))}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className={styles.itemPhotoUpload}>
                        <ImagePlus size={14} />
                        <span>Прикрепить фото / эскиз</span>
                        <input
                          type="file"
                          accept="image/*"
                          className={styles.hiddenInput}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setItemPhotos((prev) => ({ ...prev, [idx]: file }));
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}

            {errors.items && typeof errors.items.message === 'string' && (
              <div className={styles.formError}>
                <AlertCircle size={13} />
                {errors.items.message}
              </div>
            )}

            <div className={styles.itemsFooter}>
              <button
                type="button"
                className={styles.addItemBtn}
                onClick={() => append({ productName: '', gender: '', length: '', color: '', size: '', quantity: 1, unitPrice: 0, itemDiscount: 0, workshopNotes: '' })}
              >
                <Plus size={13} />
                Добавить позицию
              </button>
              {itemsTotal > 0 && (
                <div className={styles.itemsTotal}>
                  <Calculator size={13} />
                  <span>Итого по позициям:</span>
                  <strong>{fmt(itemsTotal)}</strong>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 03 Сроки и приоритет ──────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>03</span>
            <span className={styles.sectionTitle}>Сроки и приоритет</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>Дата принятия заказа</label>
                <input {...register('orderDate')} type="date" className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Срок готовности</label>
                <input {...register('dueDate')} type="date" className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Приоритет</label>
                <div className={styles.priorityGroup}>
                  {(['normal', 'urgent', 'vip'] as Priority[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.priorityBtn} ${priority === value ? styles.priorityBtnActive : ''} ${value === 'urgent' ? styles.priorityBtnUrgent : ''} ${value === 'vip' ? styles.priorityBtnVip : ''}`}
                      onClick={() => setValue('priority', value)}
                    >
                      {value === 'normal' ? 'Обычный' : value === 'urgent' ? '🔴 Срочно' : '⭐ VIP'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 04 Оплата ─────────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>04</span>
            <span className={styles.sectionTitle}>Оплата</span>
          </div>
          <div className={styles.sectionBody}>

            {/* Итого по позициям / скидка / итого к оплате */}
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>Итого по позициям (₸)</label>
                <div className={styles.calcDisplay}>
                  {itemsTotal > 0 ? fmt(itemsTotal) : '—'}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Скидка на заказ (₸)</label>
                <Controller control={control} name="orderDiscount" render={({ field }) => (
                  <input
                    type="number" min="0" inputMode="numeric"
                    className={styles.input}
                    placeholder="0"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseOptionalAmount(e.target.value))}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => e.target.select()}
                  />
                )} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Итого к оплате (₸)</label>
                <div className={styles.calcDisplay}>
                  {itemsTotal > 0 ? fmt(finalTotal) : '—'}
                  {orderDiscount > 0 && itemsTotal > 0 && (
                    <span className={styles.calcSaveBadge}>−{fmt(orderDiscount)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Предоплата / остаток */}
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Предоплата (₸)</label>
                <Controller control={control} name="prepayment" render={({ field }) => (
                  <input
                    type="number" min="0" max={finalTotal || undefined} inputMode="numeric"
                    className={`${styles.input} ${errors.prepayment ? styles.inputError : ''}`}
                    placeholder="0"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseOptionalAmount(e.target.value))}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => e.target.select()}
                  />
                )} />
                {errors.prepayment && <span className={styles.fieldError}>{errors.prepayment.message}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Остаток (₸)</label>
                <div className={styles.calcDisplay}>
                  {finalTotal > 0 ? fmt(debt) : '—'}
                </div>
              </div>
            </div>

            {/* Способ оплаты */}
            <div className={styles.field}>
              <label className={styles.label}>
                Способ оплаты
                {prepayment > 0 && <span className={styles.req}> *</span>}
              </label>
              <div className={styles.payMethodBtns}>
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={[
                      styles.payMethodBtn,
                      paymentMethod === m.value ? styles.payMethodBtnActive : '',
                      m.value === 'mixed' ? styles.payMethodBtnMixed : '',
                    ].join(' ')}
                    onClick={() => setValue('paymentMethod', paymentMethod === m.value ? undefined : m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {errors.paymentMethod && <span className={styles.fieldError}>{errors.paymentMethod.message}</span>}
            </div>

            {/* Смешанный — разбивка */}
            {paymentMethod === 'mixed' && (
              <div className={styles.mixedBreakdown}>
                <div className={styles.mixedBreakdownTitle}>Разбивка по способам оплаты</div>
                {MIXED_METHODS.map((m) => (
                  <div key={m.key} className={styles.mixedRow}>
                    <span className={styles.mixedLabel}>{m.label}</span>
                    <Controller control={control} name={m.key} render={({ field }) => (
                      <input
                        type="number" min="0" inputMode="numeric"
                        className={styles.mixedInput}
                        placeholder="0 ₸"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(parseOptionalAmount(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        onFocus={(e) => e.target.select()}
                      />
                    )} />
                  </div>
                ))}
                {mixedSum > 0 && (
                  <div className={styles.mixedTotal}>
                    Итого в разбивке: <strong>{fmt(mixedSum)}</strong>
                    {prepayment > 0 && Math.abs(mixedSum - prepayment) > 1 && (
                      <span className={styles.mixedMismatch}> ≠ предоплата {fmt(prepayment)}</span>
                    )}
                  </div>
                )}
                {errors.mixedCash && <span className={styles.fieldError}>{errors.mixedCash.message}</span>}
              </div>
            )}

            {/* Чеки / квитанции */}
            <div className={styles.field}>
              <label className={styles.label}>Чеки / квитанции</label>
              {receipts.length > 0 && (
                <div className={styles.fileList}>
                  {receipts.map((f, i) => (
                    <div key={i} className={styles.fileItem}>
                      <Paperclip size={12} />
                      <span className={styles.fileName}>{f.name}</span>
                      <button type="button" className={styles.fileRemoveBtn} onClick={() => setReceipts((r) => r.filter((_, j) => j !== i))}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className={styles.receiptUpload}>
                <Paperclip size={14} />
                <span>Прикрепить чек...</span>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setReceipts((r) => [...r, ...files]);
                    if (receiptInputRef.current) receiptInputRef.current.value = '';
                  }}
                />
              </label>
            </div>

          </div>
        </section>

        {/* ── 05 Примечания ─────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>05</span>
            <span className={styles.sectionTitle}>Примечания</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <label className={styles.label}>Внутренняя заметка (только для команды)</label>
              <textarea {...register('managerNote')} className={styles.textarea} placeholder="Особые пожелания, договорённости..." rows={3} />
            </div>
          </div>
        </section>

        <div className={styles.formActions}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/workzone/chapan/orders')}>
            Отмена
          </button>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting || createOrder.isPending}>
            {createOrder.isPending ? 'Создание...' : 'Создать заказ'}
          </button>
        </div>

      </form>
    </div>
  );
}
