import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, Plus, User } from 'lucide-react';
import { api } from '../../shared/api/client';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useUIStore } from '../../shared/stores/ui';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageLoader } from '../../shared/ui/PageLoader';
import { formatMoney } from '../../shared/utils/format';
import styles from './Deals.module.css';

type DealListItem = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  stage: {
    id: string;
    name: string;
    color: string;
  };
  customer_name: string;
  owner_name: string | null;
};

type DealListResponse = {
  results: DealListItem[];
};

export default function DealsPage() {
  const navigate = useNavigate();
  const openCreateDeal = useUIStore((state) => state.openCreateDeal);
  const [query, setQuery] = useState('');

  useDocumentTitle('Сделки');

  const { data, isLoading } = useQuery<DealListResponse>({
    queryKey: ['deals', 'page'],
    queryFn: () => api.get('/deals/', { page_size: 100 }),
  });

  const items = data?.results ?? [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) =>
      item.title.toLowerCase().includes(normalized)
      || item.customer_name.toLowerCase().includes(normalized)
      || (item.owner_name ?? '').toLowerCase().includes(normalized),
    );
  }, [items, query]);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Сделки</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
            Активные и завершённые сделки по текущей воронке.
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => openCreateDeal()}>
          Новая сделка
        </Button>
      </div>

      <input
        className="kort-input"
        aria-label="Поиск сделок"
        placeholder="Поиск по сделке, клиенту или ответственному"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CircleDollarSign size={20} />}
          title={items.length === 0 ? 'Сделок пока нет' : 'Ничего не найдено'}
          description={items.length === 0
            ? 'Создайте первую сделку, чтобы команда могла вести её по воронке.'
            : 'Измените поисковый запрос и попробуйте снова.'}
          action={items.length === 0
            ? { label: 'Создать сделку', onClick: () => openCreateDeal() }
            : undefined}
        />
      ) : (
        <div className={styles.list}>
          {filtered.map((deal) => (
            <button
              key={deal.id}
              type="button"
              className={styles.card}
              onClick={() => navigate(`/deals/${deal.id}`)}
            >
              <span className={styles.avatar}>
                <CircleDollarSign size={18} />
              </span>

              <span className={styles.cardBody}>
                <span className={styles.cardHead}>
                  <span className={styles.nameBlock}>
                    <span className={styles.name}>{deal.title}</span>
                    <span className={styles.owner}>
                      <User size={12} />
                      {deal.owner_name ?? deal.customer_name}
                    </span>
                  </span>

                  <span className={styles.metaRight}>
                    <span
                      className={styles.stage}
                      style={{ '--stage-color': deal.stage.color } as CSSProperties}
                    >
                      {deal.stage.name}
                    </span>
                    <span className={styles.amount}>{formatMoney(deal.amount, deal.currency)}</span>
                  </span>
                </span>

                <span className={styles.status}>
                  Клиент: {deal.customer_name || 'не указан'} • Статус: {deal.status}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
