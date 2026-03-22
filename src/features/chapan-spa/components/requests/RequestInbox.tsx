import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Archive, CalendarDays, ChevronDown, MessageCircle, Package2, Phone, Sparkles } from 'lucide-react';
import { useChapanStore } from '../../model/chapan.store';
import { useTileChapanUI } from '../../model/tile-ui.store';
import type { ClientRequest, ClientRequestStatus } from '../../api/types';
import s from './RequestInbox.module.css';

type Filter = 'active' | 'new' | 'reviewed' | 'converted' | 'archived';

const STATUS_LABEL: Record<ClientRequestStatus, string> = {
  new: 'Новая',
  reviewed: 'В работе',
  converted: 'Конвертирована',
  archived: 'Архив',
};

const FILTER_OPTIONS: Array<{ value: Filter; label: string }> = [
  { value: 'active', label: 'Активные' },
  { value: 'new', label: 'Новые' },
  { value: 'reviewed', label: 'В работе' },
  { value: 'converted', label: 'Конвертированные' },
  { value: 'archived', label: 'Архив' },
];

function preferredContactLabel(value: ClientRequest['preferredContact']) {
  if (value === 'whatsapp') return 'предпочитает WhatsApp';
  if (value === 'telegram') return 'предпочитает Telegram';
  return 'предпочитает звонок';
}

function matchesFilter(request: ClientRequest, filter: Filter) {
  if (filter === 'active') {
    return request.status === 'new' || request.status === 'reviewed';
  }

  return request.status === filter;
}

export function RequestInbox({ tileId }: { tileId: string }) {
  const { requests, refreshRequests, setRequestStatus } = useChapanStore();
  const { openCreateModalWithPrefill } = useTileChapanUI(tileId);
  const [filter, setFilter] = useState<Filter>('active');
  const [expandedId, setExpandedId] = useState<string | null>(requests[0]?.id ?? null);

  useEffect(() => {
    refreshRequests();
  }, [refreshRequests]);

  const counts = useMemo(() => ({
    active: requests.filter((item) => item.status === 'new' || item.status === 'reviewed').length,
    new: requests.filter((item) => item.status === 'new').length,
    reviewed: requests.filter((item) => item.status === 'reviewed').length,
    converted: requests.filter((item) => item.status === 'converted').length,
    archived: requests.filter((item) => item.status === 'archived').length,
  }), [requests]);

  const visible = useMemo(
    () => requests.filter((request) => matchesFilter(request, filter)),
    [filter, requests],
  );

  useEffect(() => {
    if (!visible.length) {
      setExpandedId(null);
      return;
    }

    if (!expandedId || !visible.some((request) => request.id === expandedId)) {
      setExpandedId(visible[0].id);
    }
  }, [expandedId, visible]);

  if (!requests.length) {
    return (
      <div className={s.empty}>
        <Sparkles size={24} />
        <div className={s.emptyTitle}>Заявок пока нет</div>
        <div className={s.emptyText}>
          Включите форму заявки и отправьте клиентам ссылку. Новые обращения появятся здесь.
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.inboxHeader}>
        <div className={s.inboxMeta}>
          <span className={s.inboxCount}>{visible.length}</span>
          <span className={s.inboxCountLabel}>заявок</span>
        </div>
        <div className={s.filterSelect}>
          <select
            className={s.filterSelectEl}
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            aria-label="Фильтр по статусу"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({counts[opt.value]})
              </option>
            ))}
          </select>
          <ChevronDown size={13} className={s.filterSelectIcon} />
        </div>
      </div>

      {visible.length === 0 && (
        <div className={s.filteredEmpty}>
          <div className={s.filteredEmptyTitle}>В этом фильтре заявок нет</div>
          <div className={s.filteredEmptyText}>
            Переключите статус сверху или дождитесь новых обращений.
          </div>
        </div>
      )}

      <div className={s.list}>
        {visible.map((request) => {
          const expanded = expandedId === request.id;

          return (
            <article
              key={request.id}
              className={`${s.card} ${expanded ? s.cardExpanded : ''}`}
            >
              <button className={s.cardHead} onClick={() => setExpandedId(expanded ? null : request.id)}>
                <div className={s.cardIdentity}>
                  <span className={s.requestNumber}>{request.requestNumber}</span>
                  <span className={s.statusChip} data-status={request.status}>{STATUS_LABEL[request.status]}</span>
                </div>
                <div className={s.requestName}>{request.customerName}</div>
                <div className={s.requestMeta}>
                  <span><Package2 size={12} /> {request.items.length} позиций</span>
                  {request.desiredDate && (
                    <span><CalendarDays size={12} /> {new Date(request.desiredDate).toLocaleDateString('ru-RU')}</span>
                  )}
                  {request.city && <span>{request.city}</span>}
                  {request.deliveryMethod && <span>{request.deliveryMethod}</span>}
                  <span>{request.leadSource || (request.source === 'public_form' ? 'Форма заявки' : 'WhatsApp / менеджер')}</span>
                </div>
              </button>

              {expanded && (
                <div className={s.cardBody}>
                  <div className={s.contactRow}>
                    <span><Phone size={12} /> {request.phone}</span>
                    <span><MessageCircle size={12} /> {preferredContactLabel(request.preferredContact)}</span>
                    {request.messengers?.length ? <span>Мессенджеры: {request.messengers.join(', ')}</span> : null}
                    {request.city && <span>Город: {request.city}</span>}
                    {request.deliveryMethod && <span>Доставка: {request.deliveryMethod}</span>}
                    {request.leadSource && <span>Источник: {request.leadSource}</span>}
                  </div>

                  <div className={s.itemsGrid}>
                    {request.items.map((item) => (
                      <div key={item.id} className={s.itemCard}>
                        <div className={s.itemTitle}>{item.productName}</div>
                        <div className={s.itemMeta}>
                          {item.fabricPreference || 'Материал не указан'} · {item.size || 'Размер уточнить'} · ×{item.quantity}
                        </div>
                        {item.notes && <div className={s.itemNotes}>{item.notes}</div>}
                      </div>
                    ))}
                  </div>

                  {request.notes && (
                    <div className={s.notesBox}>{request.notes}</div>
                  )}

                  <div className={s.actions}>
                    {request.status === 'new' && (
                      <button
                        className={s.secondaryBtn}
                        onClick={() => setRequestStatus(request.id, 'reviewed')}
                      >
                        Взять в работу
                      </button>
                    )}

                    {(request.status === 'new' || request.status === 'reviewed') && (
                      <button
                        className={s.primaryBtn}
                        onClick={() => openCreateModalWithPrefill({
                          sourceRequestId: request.id,
                          clientName: request.customerName,
                          clientPhone: request.phone,
                          dueDate: request.desiredDate,
                          items: request.items.map((item) => ({
                            productName: item.productName,
                            fabric: item.fabricPreference,
                            size: item.size,
                            quantity: item.quantity,
                            workshopNotes: [item.notes, request.notes].filter(Boolean).join(' • '),
                          })),
                        })}
                      >
                        Оформить заказ
                        <ArrowRight size={14} />
                      </button>
                    )}

                    {request.status !== 'archived' && request.status !== 'converted' && (
                      <button
                        className={s.ghostBtn}
                        onClick={() => setRequestStatus(request.id, 'archived')}
                      >
                        <Archive size={13} />
                        Архивировать
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
