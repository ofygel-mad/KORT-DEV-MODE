import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, Plus, Trash2, Calculator, AlertCircle } from 'lucide-react';
import { useCreateOrder, useChapanCatalogs } from '../../../../entities/order/queries';
import type { Priority } from '../../../../entities/order/types';
import styles from './ChapanNewOrder.module.css';

const itemSchema = z.object({
  productName: z.string().min(1, 'Укажите модель'),
  fabric:      z.string().min(1, 'Укажите ткань'),
  size:        z.string().min(1, 'Укажите размер'),
  quantity:    z.coerce.number().int().min(1),
  unitPrice:   z.coerce.number().min(0),
  workshopNotes: z.string().optional(),
});

const schema = z.object({
  clientName:   z.string().min(2, 'Минимум 2 символа'),
  clientPhone:  z.string().min(1, 'Телефон обязателен').regex(/^\+?[\d\s\-()]{7,}$/, 'Неверный формат'),
  city:         z.string().optional(),
  deliveryType: z.string().optional(),
  source:       z.string().optional(),
  priority:     z.enum(['normal', 'urgent', 'vip']),
  dueDate:      z.string().optional(),
  prepayment:   z.coerce.number().min(0).optional(),
  paymentMethod:z.string().optional(),
  items:        z.array(itemSchema).min(1, 'Добавьте хотя бы одну позицию'),
  managerNote:  z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const CITIES    = ['Алматы', 'Астана', 'Шымкент', 'Атырау', 'Актобе', 'Тараз', 'Павлодар', 'Другой город'];
const DELIVERY  = ['Самовывоз', 'Курьер по городу', 'Казпочта', 'СДЭК', 'Другое'];
const SOURCES   = ['Instagram', 'WhatsApp', 'Telegram', 'Звонок', 'Рекомендация', 'Сайт', 'Другое'];
const PAYMENTS  = ['Наличные', 'Kaspi QR', 'Kaspi перевод', 'Карта', 'Смешанный'];

function SelectOrText({ options, placeholder, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { options: string[] }) {
  const id = `dl-${Math.random().toString(36).slice(2)}`;
  return (
    <>
      <datalist id={id}>{options.map(o => <option key={o} value={o} />)}</datalist>
      <input {...props} list={id} placeholder={placeholder} className={className} autoComplete="off" />
    </>
  );
}

export default function ChapanNewOrderPage() {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const { data: catalogs } = useChapanCatalogs();

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'normal',
      items: [{ productName: '', fabric: '', size: '', quantity: 1, unitPrice: 0, workshopNotes: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items   = watch('items');
  const priority = watch('priority');
  const total = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);

  function fmt(n: number) { return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸'; }

  async function onSubmit(data: FormData) {
    await createOrder.mutateAsync({
      clientName: data.clientName, clientPhone: data.clientPhone,
      priority: data.priority as Priority,
      dueDate: data.dueDate || undefined,
      items: data.items.map(it => ({
        productName: it.productName, fabric: it.fabric, size: it.size,
        quantity: it.quantity, unitPrice: it.unitPrice,
        workshopNotes: it.workshopNotes || undefined,
      })),
    });
    navigate('/workzone/chapan/orders');
  }

  const products = catalogs?.productCatalog ?? [];
  const fabrics  = catalogs?.fabricCatalog  ?? [];
  const sizes    = catalogs?.sizeCatalog    ?? [];

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <button className={styles.backLink} onClick={() => navigate('/workzone/chapan/orders')}>
          <ChevronLeft size={14} /><span>Заказы</span>
        </button>
        <h1 className={styles.pageTitle}>Новый заказ</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        {/* ── 01 Клиент ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>01</span>
            <span className={styles.sectionTitle}>Данные клиента</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>ФИО клиента <span className={styles.req}>*</span></label>
                <input {...register('clientName')} className={`${styles.input} ${errors.clientName ? styles.inputError : ''}`} placeholder="Иванов Иван Иванович" autoFocus />
                {errors.clientName && <span className={styles.fieldError}>{errors.clientName.message}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Телефон <span className={styles.req}>*</span></label>
                <input {...register('clientPhone')} type="tel" className={`${styles.input} ${errors.clientPhone ? styles.inputError : ''}`} placeholder="+7 701 234 5678" />
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
                <label className={styles.label}>Доставка</label>
                <Controller control={control} name="deliveryType" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={DELIVERY} placeholder="Выберите или введите" className={styles.input} />
                )} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Источник</label>
                <Controller control={control} name="source" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={SOURCES} placeholder="Instagram, звонок..." className={styles.input} />
                )} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 Позиции ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>02</span>
            <span className={styles.sectionTitle}>Позиции заказа</span>
          </div>
          <div className={styles.sectionBody}>
            {fields.map((field, idx) => (
              <div key={field.id} className={styles.itemCard}>
                <div className={styles.itemCardHeader}>
                  <span className={styles.itemCardLabel}>Позиция {idx + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" className={styles.itemRemoveBtn} onClick={() => remove(idx)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Row 1: Model / Fabric / Size */}
                <div className={styles.itemRow3}>
                  <div className={styles.field}>
                    <label className={styles.label}>Модель <span className={styles.req}>*</span></label>
                    <Controller control={control} name={`items.${idx}.productName`} render={({ field: f }) => (
                      products.length > 0
                        ? <select {...f} className={`${styles.select} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`}>
                            <option value="">Выберите модель</option>
                            {products.map(p => <option key={p} value={p}>{p}</option>)}
                            <option value="__other">Другая модель...</option>
                          </select>
                        : <input {...f} className={`${styles.input} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`} placeholder="Назар — шапан" />
                    )} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Ткань <span className={styles.req}>*</span></label>
                    <Controller control={control} name={`items.${idx}.fabric`} render={({ field: f }) => (
                      fabrics.length > 0
                        ? <select {...f} className={`${styles.select} ${errors.items?.[idx]?.fabric ? styles.inputError : ''}`}>
                            <option value="">Выберите ткань</option>
                            {fabrics.map(fab => <option key={fab} value={fab}>{fab}</option>)}
                          </select>
                        : <input {...f} className={`${styles.input} ${errors.items?.[idx]?.fabric ? styles.inputError : ''}`} placeholder="Шерсть" />
                    )} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Размер <span className={styles.req}>*</span></label>
                    <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => (
                      sizes.length > 0
                        ? <select {...f} className={`${styles.select} ${errors.items?.[idx]?.size ? styles.inputError : ''}`}>
                            <option value="">Размер</option>
                            {sizes.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                          </select>
                        : <input {...f} className={`${styles.input} ${errors.items?.[idx]?.size ? styles.inputError : ''}`} placeholder="48" />
                    )} />
                  </div>
                </div>

                {/* Row 2: Quantity / Price */}
                <div className={styles.itemRow2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Количество</label>
                    <input {...register(`items.${idx}.quantity`, { valueAsNumber: true })} type="number" min="1" className={styles.input} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Цена за единицу (₸)</label>
                    <input {...register(`items.${idx}.unitPrice`, { valueAsNumber: true })} type="number" min="0" className={styles.input} placeholder="0" />
                  </div>
                </div>

                {/* Workshop note */}
                <div className={styles.itemNoteField}>
                  <input {...register(`items.${idx}.workshopNotes`)} className={styles.itemNoteInput} placeholder="Заметка для цеха (необязательно)..." />
                </div>
              </div>
            ))}

            {errors.items && typeof errors.items.message === 'string' && (
              <div className={styles.formError}><AlertCircle size={13} />{errors.items.message}</div>
            )}

            <div className={styles.itemsFooter}>
              <button type="button" className={styles.addItemBtn}
                onClick={() => append({ productName: '', fabric: '', size: '', quantity: 1, unitPrice: 0, workshopNotes: '' })}>
                <Plus size={13} /> Добавить позицию
              </button>
              {total > 0 && (
                <div className={styles.itemsTotal}>
                  <Calculator size={13} /><span>Итого:</span><strong>{fmt(total)}</strong>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 03 Сроки и приоритет ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>03</span>
            <span className={styles.sectionTitle}>Сроки и приоритет</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Дедлайн</label>
                <input {...register('dueDate')} type="date" className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Приоритет</label>
                <div className={styles.priorityGroup}>
                  {(['normal','urgent','vip'] as Priority[]).map(p => (
                    <button key={p} type="button"
                      className={`${styles.priorityBtn} ${priority === p ? styles.priorityBtnActive : ''} ${p === 'urgent' ? styles.priorityBtnUrgent : ''} ${p === 'vip' ? styles.priorityBtnVip : ''}`}
                      onClick={() => setValue('priority', p)}
                    >
                      {p === 'normal' ? 'Обычный' : p === 'urgent' ? '🔴 Срочно' : '⭐ VIP'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 04 Оплата ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>04</span>
            <span className={styles.sectionTitle}>Оплата</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.payRow}>
              <div className={styles.field}>
                <label className={styles.label}>Предоплата (₸)</label>
                <input {...register('prepayment', { valueAsNumber: true })} type="number" min="0" className={styles.input} placeholder="0" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Способ оплаты</label>
                <select {...register('paymentMethod')} className={styles.select}>
                  <option value="">Не указан</option>
                  {PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {total > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>Сумма заказа</label>
                  <div className={styles.input} style={{ color: 'var(--ch-plat-bright)', fontWeight: 700 }}>{fmt(total)}</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 05 Примечания ── */}
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
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/workzone/chapan/orders')}>Отмена</button>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting || createOrder.isPending}>
            {createOrder.isPending ? 'Создание...' : 'Создать заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}
