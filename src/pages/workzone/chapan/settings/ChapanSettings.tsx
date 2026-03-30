import { useState } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { useChapanCatalogs, useChapanProfile, useSaveCatalogs, useSaveProfile } from '../../../../entities/order/queries';
import { useChapanClients } from '../../../../entities/order/queries';
import type { ChapanCatalogs } from '../../../../entities/order/types';
import styles from './ChapanSettings.module.css';

type CatalogKey = 'productCatalog' | 'fabricCatalog' | 'sizeCatalog' | 'workers';

const PRESET_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Синий',                hex: '#1d4ed8' },
  { name: 'Светлый беж',          hex: '#e8d5b0' },
  { name: 'Голубой',              hex: '#38bdf8' },
  { name: 'Мокрый асфальт',       hex: '#4a5568' },
  { name: 'Верблюжка',            hex: '#c19a6b' },
  { name: 'Черный',               hex: '#111111' },
  { name: 'Оранжевый',            hex: '#f97316' },
  { name: 'Коричневый',           hex: '#7c4a1e' },
  { name: 'Серый',                hex: '#9ca3af' },
  { name: 'Изумруд',              hex: '#059669' },
  { name: 'Шоколадный',           hex: '#5c2e0e' },
  { name: 'Розовый',              hex: '#f472b6' },
  { name: 'Белый',                hex: '#f5f5f5' },
  { name: 'Красный',              hex: '#dc2626' },
  { name: 'Зеленый',              hex: '#16a34a' },
  { name: 'Бордовый',             hex: '#9b1c1c' },
  { name: 'Фиолетовый',           hex: '#7c3aed' },
  { name: 'Кофе',                 hex: '#6f4e37' },
  { name: 'Желтый',               hex: '#eab308' },
  { name: 'Темно мокрый',         hex: '#1e2a3a' },
  { name: 'Хаки (темно-зеленый)', hex: '#4a5e2e' },
];

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

  function addItem(key: CatalogKey, value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (getList(key).map(v => v.toLowerCase()).includes(trimmed.toLowerCase())) return false; // дубль
    const next = { ...(current ?? { productCatalog: [], fabricCatalog: [], sizeCatalog: [], workers: [] }) };
    next[key] = [...(next[key] ?? []), trimmed];
    setDraft(next);
    return true;
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
    { key: 'sizeCatalog',    title: 'Размеры',           placeholder: '44, 46, 48...' },
    { key: 'workers',        title: 'Работники цеха',    placeholder: 'Имя работника...' },
  ];

  function toggleColor(name: string) {
    const next = { ...(current ?? { productCatalog: [], fabricCatalog: [], sizeCatalog: [], workers: [] }) };
    const active = next.fabricCatalog ?? [];
    next.fabricCatalog = active.includes(name) ? active.filter(v => v !== name) : [...active, name];
    setDraft(next);
  }

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

      <ColorCatalogSection
        activeColors={getList('fabricCatalog')}
        onToggle={toggleColor}
      />

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
  onAdd: (v: string) => boolean;
  onRemove: (v: string) => void;
}) {
  const [input, setInput] = useState('');
  const [dupError, setDupError] = useState(false);

  function handleAdd() {
    if (!input.trim()) return;
    const added = onAdd(input.trim());
    if (added) {
      setInput('');
      setDupError(false);
    } else {
      setDupError(true);
      setTimeout(() => setDupError(false), 2000);
    }
  }

  return (
    <div className={styles.catalogSection}>
      <div className={styles.catalogTitleRow}>
        <span className={styles.catalogTitle}>{title}</span>
        {items.length > 0 && <span className={styles.catalogCount}>{items.length}</span>}
      </div>
      <div className={styles.catalogAddRow}>
        <input
          className={`${styles.catalogInput} ${dupError ? styles.catalogInputError : ''}`}
          value={input}
          onChange={e => { setInput(e.target.value); setDupError(false); }}
          placeholder={dupError ? '⚠ Уже есть в списке' : placeholder}
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

// ── Color catalog section ─────────────────────────────────────────────────────

function ColorCatalogSection({
  activeColors,
  onToggle,
}: {
  activeColors: string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div className={styles.colorSection}>
      <div className={styles.colorSectionHead}>
        <span className={styles.catalogTitle}>Цвета товаров</span>
        <span className={styles.colorSectionHint}>
          {activeColors.length > 0 ? `Выбрано: ${activeColors.length}` : 'Нажмите на цвет, чтобы включить его'}
        </span>
      </div>
      <div className={styles.colorGrid}>
        {PRESET_COLORS.map((c) => {
          const active = activeColors.includes(c.name);
          return (
            <button
              key={c.name}
              type="button"
              className={`${styles.colorChip} ${active ? styles.colorChipActive : ''}`}
              onClick={() => onToggle(c.name)}
            >
              <span
                className={styles.colorDot}
                style={{
                  background: c.hex,
                  border: c.name === 'Белый' ? '1px solid rgba(255,255,255,0.3)' : undefined,
                }}
              />
              <span>{c.name}</span>
            </button>
          );
        })}
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
