import { useEffect } from 'react';
import { ArrowLeft, Lock, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useChapanStore } from '../../model/chapan.store';
import { useResolvedChapanAlias, useResolvedChapanRole } from '../../model/rbac.store';
import { useAuthStore } from '@/shared/stores/auth';
import { ProductionQueue } from '../production/ProductionQueue';
import s from './WorkshopConsole.module.css';

const ROLE_LABEL = {
  manager: 'Менеджер',
  workshop_lead: 'Старший цеха',
  worker: 'Сотрудник цеха',
  viewer: 'Наблюдатель',
} as const;

interface Props {
  title: string;
  onBack: () => void;
}

export function WorkshopConsole({ title, onBack }: Props) {
  const { loading, load } = useChapanStore();
  const role = useResolvedChapanRole();
  const alias = useResolvedChapanAlias();
  const userName = useAuthStore((state) => state.user?.full_name ?? alias);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className={s.loading}>
        <RefreshCw size={18} className={s.spin} />
        <span>Загружаю задачи цеха...</span>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.topBar}>
        <div className={s.headMain}>
          <button className={s.backBtn} onClick={onBack}>
            <ArrowLeft size={15} />
            <span>К производствам</span>
          </button>
          <h1 className={s.title}>{title}</h1>
        </div>

        <div className={s.pills}>
          <span className={s.pill}>
            <ShieldCheck size={14} />
            {ROLE_LABEL[role]}
          </span>
          <span className={s.pill}>
            <Sparkles size={14} />
            {userName}
          </span>
          <span className={s.pill}>
            <Lock size={14} />
            Клиентские данные скрыты
          </span>
        </div>
      </div>

      <div className={s.boardShell}>
        <ProductionQueue mode={role === 'workshop_lead' ? 'workshop_lead' : 'worker'} />
      </div>
    </div>
  );
}
