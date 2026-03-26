import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useOrder, useUpdateOrder, useChapanCatalogs } from '../../../../entities/order/queries';
import type { Priority } from '../../../../entities/order/types';
import { formatPersonNameInput } from '../../../../shared/utils/person';
import { formatKazakhPhoneInput, isKazakhPhoneComplete } from '../../../../shared/utils/kz';
import styles from './ChapanNewOrder.module.css';

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  fabric: z.string().optional(),
  productName: z.string().min(1, 'Укажите модель'),
  size:        z.string().min(1, 'Укажите размер'),
  quantity:    z.coerce.number().int().min(1),
  unitPrice:   z.coerce.number().min(0).default(0),
  workshopNotes: z.string().optional(),
});

const schema = z.object({
  clientName:  z.string().min(2, 'Минимум 2 символа'),
  clientPhone: z.string()
    .min(1, 'Телефон обязателен')
    .refine((value) => isKazakhPhoneComplete(value), 'Введите номер в формате +7 (777)-777-77-77'),
  dueDate:     z.string().optional(),
  priority:    z.enum(['normal', 'urgent', 'vip']),
  items:       z.array(itemSchema).min(1, 'Добавьте хотя бы одну позицию'),
});

type FormData = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChapanEditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading, isError } = useOrder(id!);
  const updateOrder = useUpdateOrder();
  const { data: catalogs } = useChapanCatalogs();

  const products = catalogs?.productCatalog ?? [];
  const sizes    = catalogs?.sizeCatalog    ?? [];

  const {
    register, control, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'normal', items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const priority = watch('priority');
  const items    = watch('items');

  // Populate form when order loads
  useEffect(() => {
    if (!order) return;
    reset({
      clientName:  formatPersonNameInput(order.clientName),
      clientPhone: formatKazakhPhoneInput(order.clientPhone),
      dueDate:     order.dueDate ? order.dueDate.slice(0, 10) : '',
      priority:    order.priority as Priority,
      items: (order.items ?? []).map(item => ({
        fabric:        item.fabric ?? '',
        productName:   item.productName,
        size:          item.size,
        quantity:      item.quantity,
        unitPrice:     item.unitPrice,
        workshopNotes: item.workshopNotes ?? '',
      })),
    });
  }, [order, reset]);

  const canEditItems = order?.status === 'new';

  function fmt(n: number) {
    return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
  }

  const itemsTotal = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0);

  async function onSubmit(data: FormData) {
    if (!id) return;
    await updateOrder.mutateAsync({
      id,
      dto: {
        clientName:  formatPersonNameInput(data.clientName).trim(),
        clientPhone: formatKazakhPhoneInput(data.clientPhone),
        dueDate:     data.dueDate || null,
        priority:    data.priority as Priority,
        items:       canEditItems ? data.items.map(item => ({
          fabric:        item.fabric?.trim() || undefined,
          productName:   item.productName,
          size:          item.size,
          quantity:      item.quantity,
          unitPrice:     item.unitPrice,
          workshopNotes: item.workshopNotes || undefined,
        })) : undefined,
      },
    });
    navigate(`/workzone/chapan/orders/${id}`);
  }

  if (isLoading) {
    return (
      <div className={styles.root}>
        <div style={{ padding: 40, color: 'var(--ch-text-muted)' }}>Загрузка...</div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className={styles.root}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '60px 20px', color: 'var(--ch-text-muted)' }}>
          <AlertTriangle size={24} />
          <p>Заказ не найден</p>
          <button onClick={() => navigate('/workzone/chapan/orders')} style={{ padding: '8px 18px', background: 'var(--ch-surface)', border: '1px solid var(--ch-border)', borderRadius: 7, color: 'var(--ch-plat-bright)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            ← Назад к заказам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <button className={styles.backLink} onClick={() => navigate(`/workzone/chapan/orders/${id}`)}>
          <ChevronLeft size={14} />
          <span>#{order.orderNumber}</span>
        </button>
        <h1 className={styles.pageTitle}>Редактировать заказ</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>

        {/* ── 01 Данные клиента ──────────────────────────────────────────────── */}
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
          </div>
        </section>

        {/* ── 02 Позиции заказа ──────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>02</span>
            <span className={styles.sectionTitle}>
              Позиции заказа
              {!canEditItems && (
                <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 400, color: 'var(--ch-text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                  (только для заказов со статусом «Новый»)
                </span>
              )}
            </span>
          </div>
          <div className={styles.sectionBody}>
            {fields.map((field, idx) => {
              const lineTotal = (Number(items[idx]?.quantity) || 0) * (Number(items[idx]?.unitPrice) || 0);

              return (
                <div key={field.id} className={styles.itemCard}>
                  <div className={styles.itemCardHeader}>
                    <span className={styles.itemCardLabel}>Позиция {idx + 1}</span>
                    {canEditItems && fields.length > 1 && (
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
                          <select {...f} disabled={!canEditItems} className={`${styles.select} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`}>
                            <option value="">Выберите модель</option>
                            {products.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        ) : (
                          <input {...f} disabled={!canEditItems} className={`${styles.input} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`} placeholder="Назар — жуп шапан" />
                        )
                      )} />
                      {errors.items?.[idx]?.productName && <span className={styles.fieldError}>{errors.items[idx]?.productName?.message}</span>}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Размер <span className={styles.req}>*</span></label>
                      <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => (
                        sizes.length > 0 ? (
                          <select {...f} disabled={!canEditItems} className={`${styles.select} ${errors.items?.[idx]?.size ? styles.inputError : ''}`}>
                            <option value="">— выбрать —</option>
                            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <input {...f} disabled={!canEditItems} className={`${styles.input} ${errors.items?.[idx]?.size ? styles.inputError : ''}`} placeholder="48" />
                        )
                      )} />
                      {errors.items?.[idx]?.size && <span className={styles.fieldError}>{errors.items[idx]?.size?.message}</span>}
                    </div>
                  </div>

                  {/* Кол-во + Цена */}
                  <div className={styles.itemRow2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Кол-во</label>
                      <input
                        {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                        type="number" min="1"
                        disabled={!canEditItems}
                        className={styles.input}
                        onWheel={e => e.currentTarget.blur()}
                        onFocus={e => e.target.select()}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Цена за ед. (₸)</label>
                      <input
                        {...register(`items.${idx}.unitPrice`, { valueAsNumber: true })}
                        type="number" min="0"
                        disabled={!canEditItems}
                        className={styles.input}
                        placeholder="0"
                        onWheel={e => e.currentTarget.blur()}
                        onFocus={e => e.target.select()}
                      />
                    </div>
                  </div>

                  {lineTotal > 0 && (
                    <div className={styles.lineTotalRow}>
                      <span className={styles.lineTotalFinal}>{fmt(lineTotal)}</span>
                    </div>
                  )}

                  <div className={styles.itemNoteField}>
                    <input
                      {...register(`items.${idx}.fabric`)}
                      type="hidden"
                    />
                    <input
                      {...register(`items.${idx}.workshopNotes`)}
                      disabled={!canEditItems}
                      className={styles.itemNoteInput}
                      placeholder="Комментарий для цеха (необязательно)..."
                    />
                  </div>
                </div>
              );
            })}

            {canEditItems && (
              <div className={styles.itemsFooter}>
                <button
                  type="button"
                  className={styles.addItemBtn}
                  onClick={() => append({ productName: '', size: '', quantity: 1, unitPrice: 0, workshopNotes: '' })}
                >
                  <Plus size={13} />
                  Добавить позицию
                </button>
                {itemsTotal > 0 && (
                  <div className={styles.itemsTotal}>
                    <span>Итого по позициям:</span>
                    <strong>{fmt(itemsTotal)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── 03 Сроки и приоритет ──────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>03</span>
            <span className={styles.sectionTitle}>Сроки и приоритет</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Срок готовности</label>
                <input {...register('dueDate')} type="date" className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Приоритет</label>
                <div className={styles.priorityGroup}>
                  {(['normal', 'urgent', 'vip'] as Priority[]).map(value => (
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

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate(`/workzone/chapan/orders/${id}`)}
          >
            Отмена
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || updateOrder.isPending}
          >
            {updateOrder.isPending ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>

      </form>
    </div>
  );
}
