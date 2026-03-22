import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Drawer } from '../../shared/ui/Drawer';
import { Button } from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { api } from '../../shared/api/client';
import { useCompanyAccess } from '../../shared/hooks/useCompanyAccess';
import { useUIStore } from '../../shared/stores/ui';
import { setProductMoment } from '../../shared/utils/productMoment';
import styles from './CreateCustomerDrawer.module.css';

type CustomerOption = {
  id: string;
  full_name: string;
  company_name?: string;
};

type PipelineStage = { id: string; name: string; };
type PipelineResponse = { pipeline?: { id: string; stages?: PipelineStage[] }; stages?: PipelineStage[] };

type DealForm = {
  title: string;
  amount: string;
  currency: string;
  customer_id: string;
  stage_id: string;
};

type CreatedDeal = { id: string; title: string; currency: string; amount?: number };

const DEFAULT_VALUES: DealForm = {
  title: '',
  amount: '',
  currency: 'KZT',
  customer_id: '',
  stage_id: '',
};

export function CreateDealDrawer() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const request = useUIStore((s) => s.createDealRequest);
  const { hasCompanyAccess } = useCompanyAccess();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, setValue, watch, setFocus, formState: { errors, isSubmitting } } = useForm<DealForm>({
    defaultValues: DEFAULT_VALUES,
  });

  const { data: customers } = useQuery<{ results: CustomerOption[] }>({
    queryKey: ['customers', 'quick-picker'],
    queryFn: () => api.get('/customers/', { page_size: 100 }),
    enabled: open && hasCompanyAccess,
    staleTime: 60_000,
  });

  const { data: pipeline } = useQuery<PipelineResponse>({
    queryKey: ['deals-board', 'quick-create'],
    queryFn: () => api.get('/deals/board/'),
    enabled: open && hasCompanyAccess,
    staleTime: 60_000,
  });

  const stages = useMemo(
    () => pipeline?.pipeline?.stages ?? pipeline?.stages ?? [],
    [pipeline],
  );

  const createDeal = useMutation({
    mutationFn: (payload: DealForm) => api.post<CreatedDeal>('/deals/', {
      ...payload,
      title: payload.title.trim(),
      amount: payload.amount ? Number(payload.amount) : null,
    }),
    onSuccess: (created: CreatedDeal) => {
      qc.invalidateQueries({ queryKey: ['deals-board'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['workspace-snapshot'] });
      setProductMoment(`Сделка «${created.title}» создана. Откройте карточку и зафиксируйте следующий шаг, пока контекст не успел умереть.`);
      toast.success('Сделка создана');
      setOpen(false);
      reset({ ...DEFAULT_VALUES, stage_id: stages[0]?.id ?? '' });
      if (created?.id) navigate(`/deals/${created.id}`);
    },
    onError: () => toast.error('Не удалось создать сделку'),
  });

  useEffect(() => {
    if (!request.nonce) return;
    setOpen(true);
    reset({
      ...DEFAULT_VALUES,
      title: request.payload?.title ?? '',
      customer_id: request.payload?.customerId ?? '',
      stage_id: stages[0]?.id ?? '',
    });
    setTimeout(() => setFocus('title'), 40);
  }, [request.nonce, request.payload, reset, setFocus, stages]);

  useEffect(() => {
    if (stages.length > 0 && !watch('stage_id')) {
      setValue('stage_id', stages[0].id);
    }
  }, [stages, setValue, watch]);

  return (
    <Drawer
      open={open}
      onClose={() => { setOpen(false); reset({ ...DEFAULT_VALUES, stage_id: stages[0]?.id ?? '' }); }}
      title="Новая сделка"
      subtitle="Оставьте только рабочий минимум: название, клиент, этап и сумма. Всё остальное живёт в карточке, как и положено нормальному продукту."
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" onClick={() => { setOpen(false); reset({ ...DEFAULT_VALUES, stage_id: stages[0]?.id ?? '' }); }}>Отмена</Button>
          <Button loading={isSubmitting || createDeal.isPending} onClick={handleSubmit((data) => createDeal.mutate(data))}>Создать сделку</Button>
        </div>
      }
    >
      <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
        <Input label="Название сделки" required placeholder="Например, Поставка оборудования" error={errors.title?.message} {...register('title', { required: 'Укажите название сделки', minLength: { value: 3, message: 'Название слишком короткое' }, validate: (v) => v.trim().length >= 3 || 'Название слишком короткое' })} />
        <div className={styles.row}>
          <div>
            <label className={styles.label}>Клиент</label>
            <select className="kort-input" aria-label="Клиент" {...register('customer_id', { required: 'Выберите клиента' })}>
              <option value="">Выберите клиента</option>
              {(customers?.results ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.full_name}{customer.company_name ? ` - ${customer.company_name}` : ''}</option>
              ))}
            </select>
            {errors.customer_id?.message && <p className={styles.hint}>{errors.customer_id.message}</p>}
          </div>
          <div>
            <label className={styles.label}>Этап</label>
            <select className="kort-input" aria-label="Этап сделки" {...register('stage_id', { required: 'Выберите этап' })}>
              {stages.length === 0 && <option value="">Этапы недоступны</option>}
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
            {errors.stage_id?.message && <p className={styles.hint}>{errors.stage_id.message}</p>}
          </div>
        </div>
        <div className={styles.row}>
          <Input label="Сумма" inputMode="numeric" placeholder="6500000" error={errors.amount?.message} {...register('amount', { validate: (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0) || 'Введите корректную сумму' })} />
          <div>
            <label className={styles.label}>Валюта</label>
            <select className="kort-input" aria-label="Валюта" {...register('currency')}>
              <option value="KZT">KZT</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="RUB">RUB</option>
            </select>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
