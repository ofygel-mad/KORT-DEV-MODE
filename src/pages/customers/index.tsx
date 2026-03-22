import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Mail, Phone, Plus, User } from 'lucide-react';
import { api } from '../../shared/api/client';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useUIStore } from '../../shared/stores/ui';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageLoader } from '../../shared/ui/PageLoader';
import styles from './Customers.module.css';

type CustomerListItem = {
  id: string;
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  status: string;
};

type CustomerListResponse = {
  results: CustomerListItem[];
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Активный',
  new: 'Новый',
  inactive: 'Неактивный',
  archived: 'Архив',
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const openCreateCustomer = useUIStore((state) => state.openCreateCustomer);
  const [query, setQuery] = useState('');

  useDocumentTitle('Клиенты');

  const { data, isLoading } = useQuery<CustomerListResponse>({
    queryKey: ['customers', 'page'],
    queryFn: () => api.get('/customers/', { page_size: 100 }),
  });

  const items = data?.results ?? [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) =>
      item.full_name.toLowerCase().includes(normalized)
      || item.company_name.toLowerCase().includes(normalized)
      || item.phone.toLowerCase().includes(normalized)
      || item.email.toLowerCase().includes(normalized),
    );
  }, [items, query]);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Клиенты</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
            Контакты и компании, с которыми работает команда.
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => openCreateCustomer()}>
          Новый клиент
        </Button>
      </div>

      <input
        className="kort-input"
        aria-label="Поиск клиентов"
        placeholder="Поиск по имени, компании, телефону или email"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<User size={20} />}
          title={items.length === 0 ? 'Клиентов пока нет' : 'Ничего не найдено'}
          description={items.length === 0
            ? 'Создайте первого клиента, чтобы команда могла продолжить работу в CRM.'
            : 'Измените поисковый запрос и попробуйте снова.'}
          action={items.length === 0
            ? { label: 'Создать клиента', onClick: () => openCreateCustomer() }
            : undefined}
        />
      ) : (
        <div className={styles.list}>
          {filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className={styles.card}
              onClick={() => navigate(`/customers/${customer.id}`)}
            >
              <span className={styles.avatar}>{initials(customer.full_name)}</span>

              <span className={styles.cardBody}>
                <span className={styles.cardHead}>
                  <span className={styles.nameBlock}>
                    <span className={styles.name}>{customer.full_name}</span>
                    <span className={styles.company}>
                      <Building2 size={12} />
                      {customer.company_name || 'Без компании'}
                    </span>
                  </span>
                  <span className={styles.status}>{STATUS_LABEL[customer.status] ?? customer.status}</span>
                </span>

                <span className={styles.meta}>
                  {customer.phone && (
                    <span className={styles.metaItem}>
                      <Phone size={13} />
                      {customer.phone}
                    </span>
                  )}
                  {customer.email && (
                    <span className={styles.metaItem}>
                      <Mail size={13} />
                      {customer.email}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
