import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Copy,
  Palette,
  Phone,
  Sparkles,
  Users,
} from 'lucide-react';
import { useChapanStore } from '../../model/chapan.store';
import { useChapanRbac, type ChapanRole } from '../../model/rbac.store';
import { api } from '../../../../shared/api/client';
import type { TeamMemberResponse } from '../../../../shared/api/contracts';
import s from './WorkshopSettings.module.css';

const ROLE_OPTIONS: ChapanRole[] = ['manager', 'workshop_lead', 'worker', 'viewer'];

const ROLE_LABEL: Record<ChapanRole, string> = {
  manager: 'Менеджер',
  workshop_lead: 'Старший цеха',
  worker: 'Сотрудник цеха',
  viewer: 'Наблюдатель',
};

function TagEditor({
  title,
  items,
  onSave,
}: {
  title: string;
  items: string[];
  onSave: (items: string[]) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState(items);
  const [nextValue, setNextValue] = useState('');

  useEffect(() => {
    setDrafts(items);
  }, [items]);

  const addItem = () => {
    const value = nextValue.trim();
    if (!value) return;
    setDrafts((state) => [...state, value]);
    setNextValue('');
  };

  const removeItem = (value: string) => {
    setDrafts((state) => state.filter((item) => item !== value));
  };

  return (
    <section className={s.panel}>
      <div className={s.sectionHead}>
        <div className={s.sectionTitle}>{title}</div>
      </div>

      <div className={s.inlineForm}>
        <input
          className={s.input}
          value={nextValue}
          placeholder="Добавить значение"
          onChange={(event) => setNextValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addItem()}
        />
        <button className={s.secondaryBtn} onClick={addItem}>Добавить</button>
      </div>

      <div className={s.tagGrid}>
        {drafts.map((item) => (
          <button key={item} className={s.tag} onClick={() => removeItem(item)} title="Удалить из каталога">
            {item}
          </button>
        ))}
      </div>

      <button className={s.primaryBtn} onClick={() => onSave(drafts)}>Сохранить каталог</button>
    </section>
  );
}

export function WorkshopSettings() {
  const {
    orders,
    requests,
    workers,
    productCatalog,
    fabricCatalog,
    sizeCatalog,
    profile,
    addWorker,
    removeWorker,
    updateProfile,
    saveCatalogs,
  } = useChapanStore();
  const { setUserRole, resolveRole } = useChapanRbac();
  const [profileDraft, setProfileDraft] = useState(profile);
  const [workerInput, setWorkerInput] = useState('');

  const teamQuery = useQuery<{ results: TeamMemberResponse[] }>({
    queryKey: ['team'],
    queryFn: () => api.get('/users/team/'),
  });

  useEffect(() => {
    setProfileDraft(profile);
  }, [profile]);

  const publicLink = `${window.location.origin}/workzone/request`;

  return (
    <div className={s.root}>
      <section className={s.pageHead}>
        <h2 className={s.pageTitle}>Настройки</h2>
      </section>

      <div className={s.grid}>
        <section className={s.panel}>
          <div className={s.sectionHead}>
            <div className={s.iconWrap}><Palette size={16} /></div>
            <div>
              <div className={s.sectionTitle}>Основное</div>
            </div>
          </div>

          <div className={s.formGrid}>
            <label className={s.field}>
              <span>Название модуля</span>
              <input
                className={s.input}
                value={profileDraft.displayName}
                onChange={(event) => setProfileDraft((state) => ({ ...state, displayName: event.target.value }))}
              />
            </label>

            <label className={s.field}>
              <span>Префикс заказов</span>
              <input
                className={s.input}
                value={profileDraft.orderPrefix}
                onChange={(event) => setProfileDraft((state) => ({ ...state, orderPrefix: event.target.value.toUpperCase() }))}
              />
            </label>

            <label className={`${s.field} ${s.fieldWide}`}>
              <span>Заголовок публичной формы</span>
              <input
                className={s.input}
                value={profileDraft.publicIntakeTitle}
                onChange={(event) => setProfileDraft((state) => ({ ...state, publicIntakeTitle: event.target.value }))}
              />
            </label>

            <label className={`${s.field} ${s.fieldWide}`}>
              <span>Публичная форма</span>
              <button
                type="button"
                className={`${s.secondaryBtn} ${profileDraft.publicIntakeEnabled ? s.toggleEnabled : s.toggleDisabled}`}
                onClick={() => setProfileDraft((state) => ({ ...state, publicIntakeEnabled: !state.publicIntakeEnabled }))}
              >
                {profileDraft.publicIntakeEnabled ? 'Форма включена' : 'Форма отключена'}
              </button>
            </label>
          </div>

          <div className={s.inlineActionBar}>
            <button className={s.primaryBtn} onClick={() => updateProfile(profileDraft)}>Сохранить</button>
            <button className={s.secondaryBtn} onClick={() => navigator.clipboard.writeText(publicLink)}>
              <Copy size={14} />
              Скопировать ссылку на форму
            </button>
          </div>

          <div className={s.linkBox}>
            <Phone size={14} />
            <span>{publicLink}</span>
          </div>
        </section>

        <section className={s.panel}>
          <div className={s.sectionHead}>
            <div className={s.iconWrap}><Users size={16} /></div>
            <div>
              <div className={s.sectionTitle}>Роли</div>
            </div>
          </div>

          <div className={s.teamTable}>
            {(teamQuery.data?.results ?? []).map((member) => (
              <div key={member.id} className={s.teamRow}>
                <div>
                  <div className={s.memberName}>{member.full_name}</div>
                  <div className={s.memberMeta}>{member.email} · ERP: {member.role ?? 'viewer'}</div>
                </div>

                <select
                  className={s.select}
                  value={resolveRole(member.id, member.role ?? 'viewer')}
                  onChange={(event) => setUserRole(member.id, event.target.value as ChapanRole)}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className={s.panel}>
          <div className={s.sectionHead}>
            <div className={s.iconWrap}><Sparkles size={16} /></div>
            <div>
              <div className={s.sectionTitle}>Исполнители</div>
            </div>
          </div>

          <div className={s.inlineForm}>
            <input
              className={s.input}
              value={workerInput}
              placeholder="Имя исполнителя"
              onChange={(event) => setWorkerInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  addWorker(workerInput);
                  setWorkerInput('');
                }
              }}
            />
            <button
              className={s.primaryBtn}
              onClick={() => {
                addWorker(workerInput);
                setWorkerInput('');
              }}
            >
              Добавить
            </button>
          </div>

          <div className={s.tagGrid}>
            {workers.map((worker) => (
              <button key={worker} className={s.tag} onClick={() => removeWorker(worker)} title="Удалить исполнителя">
                {worker}
              </button>
            ))}
          </div>
        </section>

        <TagEditor
          title="Каталог изделий"
          items={productCatalog}
          onSave={(items) => saveCatalogs({ productCatalog: items })}
        />

        <TagEditor
          title="Материалы / ткани"
          items={fabricCatalog}
          onSave={(items) => saveCatalogs({ fabricCatalog: items })}
        />

        <TagEditor
          title="Размеры / варианты"
          items={sizeCatalog}
          onSave={(items) => saveCatalogs({ sizeCatalog: items })}
        />
      </div>
    </div>
  );
}
