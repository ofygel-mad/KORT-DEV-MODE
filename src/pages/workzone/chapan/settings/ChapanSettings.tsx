import { useState } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { useChapanCatalogs, useChapanProfile, useSaveCatalogs, useSaveProfile } from '../../../../entities/order/queries';
import { useChapanClients } from '../../../../entities/order/queries';
import type { ChapanCatalogs } from '../../../../entities/order/types';
import styles from './ChapanSettings.module.css';

type CatalogKey = 'productCatalog' | 'fabricCatalog' | 'sizeCatalog' | 'workers';

export default function ChapanSettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'catalogs' | 'clients'>('catalogs');

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Настройки</h1>
        <div className={styles.tabs}>
          {(['catalogs', 'profile', 'clients'] as const).map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {{ catalogs: 'Каталоги', profile: 'Профиль', clients: 'Клиенты' }[tab]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'catalogs' && <CatalogsTab />}
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'clients' && <ClientsTab />}
    </div>
  );
}

// ── Catalogs tab ──────────────────────────────────────────────────────────────

function CatalogsTab() {
  const { data: catalogs, isLoading } = useChapanCatalogs();
  const saveCatalogs = useSaveCatalogs();

  const [draft, setDraft] = useState<ChapanCatalogs | null>(null);
  const current = draft ?? catalogs;

  function getList(key: CatalogKey): string[] {
    return current?.[key] ?? [];
  }

  function addItem(key: CatalogKey, value: string) {
    const trimmed = value.trim();
    if (!trimmed || getList(key).includes(trimmed)) return;
    const next = { ...(current ?? { productCatalog: [], fabricCatalog: [], sizeCatalog: [], workers: [] }) };
    next[key] = [...(next[key] ?? []), trimmed];
    setDraft(next);
  }

  function removeItem(key: CatalogKey, value: string) {
    const next = { ...(current ?? { productCatalog: [], fabricCatalog: [], sizeCatalog: [], workers: [] }) };
    next[key] = (next[key] ?? []).filter(v => v !== value);
    setDraft(next);
  }

  async function handleSave() {
    if (!draft) return;
    await saveCatalogs.mutateAsync(draft);
    setDraft(null);
  }

  if (isLoading) return <div className={styles.loading}>Загрузка...</div>;

  const sections: { key: CatalogKey; title: string; placeholder: string }[] = [
    { key: 'productCatalog', title: 'Модели продуктов', placeholder: 'Назар — жұп шапан...' },
    { key: 'fabricCatalog',  title: 'Ткани',            placeholder: 'Шерсть, бязь, шёлк...' },
    { key: 'sizeCatalog',    title: 'Размеры',           placeholder: '44, 46, 48...' },
    { key: 'workers',        title: 'Работники цеха',    placeholder: 'Имя работника...' },
  ];

  return (
    <div className={styles.tabContent}>
      {draft && (
        <div className={styles.saveBar}>
          <span>Есть несохранённые изменения</span>
          <div className={styles.saveBarActions}>
            <button className={styles.saveBarDiscard} onClick={() => setDraft(null)}>
              Отменить
            </button>
            <button
              className={styles.saveBarSave}
              onClick={handleSave}
              disabled={saveCatalogs.isPending}
            >
              <Save size={13} />
              {saveCatalogs.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.catalogGrid}>
        {sections.map(({ key, title, placeholder }) => (
          <CatalogSection
            key={key}
            title={title}
            items={getList(key)}
            placeholder={placeholder}
            onAdd={v => addItem(key, v)}
            onRemove={v => removeItem(key, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Catalog section ───────────────────────────────────────────────────────────

function CatalogSection({
  title, items, placeholder, onAdd, onRemove,
}: {
  title: string;
  items: string[];
  placeholder: string;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [input, setInput] = useState('');

  function handleAdd() {
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput('');
  }

  return (
    <div className={styles.catalogSection}>
      <div className={styles.catalogTitle}>{title}</div>
      <div className={styles.catalogAddRow}>
        <input
          className={styles.catalogInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className={styles.catalogAddBtn} onClick={handleAdd} disabled={!input.trim()}>
          <Plus size={14} />
        </button>
      </div>
      <div className={styles.catalogList}>
        {items.map(item => (
          <div key={item} className={styles.catalogItem}>
            <span className={styles.catalogItemName}>{item}</span>
            <button
              className={styles.catalogItemRemove}
              onClick={() => onRemove(item)}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className={styles.catalogEmpty}>Список пуст</div>
        )}
      </div>
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: profile, isLoading } = useChapanProfile();
  const saveProfile = useSaveProfile();
  const [form, setForm] = useState<{ displayName: string; orderPrefix: string; publicIntakeEnabled: boolean } | null>(null);

  const current = form ?? {
    displayName: profile?.displayName ?? '',
    orderPrefix: profile?.orderPrefix ?? 'ЧП',
    publicIntakeEnabled: profile?.publicIntakeEnabled ?? false,
  };

  if (isLoading) return <div className={styles.loading}>Загрузка...</div>;

  async function handleSave() {
    await saveProfile.mutateAsync(current);
    setForm(null);
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.profileForm}>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Название мастерской</label>
          <input
            className={styles.profileInput}
            value={current.displayName}
            onChange={e => setForm({ ...current, displayName: e.target.value })}
            placeholder="Чапан Ателье"
          />
        </div>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Префикс номеров заказов</label>
          <input
            className={styles.profileInput}
            value={current.orderPrefix}
            onChange={e => setForm({ ...current, orderPrefix: e.target.value.toUpperCase().slice(0, 6) })}
            placeholder="ЧП"
            maxLength={6}
          />
          <span className={styles.profileHint}>
            Пример: #{current.orderPrefix || 'ЧП'}-042
          </span>
        </div>
        <label className={styles.profileCheckbox}>
          <input
            type="checkbox"
            checked={current.publicIntakeEnabled}
            onChange={e => setForm({ ...current, publicIntakeEnabled: e.target.checked })}
          />
          <span>Включить публичную форму заявок</span>
        </label>
        <button
          className={styles.profileSaveBtn}
          onClick={handleSave}
          disabled={saveProfile.isPending}
        >
          <Save size={14} />
          {saveProfile.isPending ? 'Сохранение...' : 'Сохранить профиль'}
        </button>
      </div>
    </div>
  );
}

// ── Clients tab ───────────────────────────────────────────────────────────────

function ClientsTab() {
  const { data, isLoading } = useChapanClients();
  const clients = data?.results ?? [];

  if (isLoading) return <div className={styles.loading}>Загрузка...</div>;

  return (
    <div className={styles.tabContent}>
      <div className={styles.clientsInfo}>
        Всего клиентов мастерской: {data?.count ?? 0}
      </div>
      <div className={styles.clientsTable}>
        <div className={styles.clientsHeader}>
          <span>Имя</span>
          <span>Телефон</span>
          <span>Email</span>
        </div>
        {clients.map(c => (
          <div key={c.id} className={styles.clientRow}>
            <span className={styles.clientName}>{c.fullName}</span>
            <a href={`tel:${c.phone}`} className={styles.clientPhone}>{c.phone}</a>
            <span className={styles.clientEmail}>{c.email ?? '—'}</span>
          </div>
        ))}
        {clients.length === 0 && (
          <div className={styles.noClients}>
            Клиенты появятся здесь после создания первого заказа
          </div>
        )}
      </div>
    </div>
  );
}
