import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Copy,
  Globe,
  Key,
  MessageSquare,
  MonitorCog,
  ShieldCheck,
  Smartphone,
  Users,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../shared/api/client';
import type { TeamMemberResponse } from '../../shared/api/contracts';
import { useCompanyAccess } from '../../shared/hooks/useCompanyAccess';
import { useCapabilities } from '../../shared/hooks/useCapabilities';
import { useRole } from '../../shared/hooks/useRole';
import { useTabsKeyboardNav } from '../../shared/hooks/useTabsKeyboardNav';
import { copyToClipboard } from '../../shared/lib/browser';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { getDeviceId, usePinStore } from '../../shared/stores/pin';
import { useAuthStore } from '../../shared/stores/auth';
import { useUIStore, type ThemePack } from '../../shared/stores/ui';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { CompanyAccessGate } from '../../shared/ui/CompanyAccessGate';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Skeleton } from '../../shared/ui/Skeleton';
import { EmployeePanel } from '../../features/auth/EmployeePanel';
import s from './Settings.module.css';

interface OrgData {
  id: string;
  name: string;
  slug?: string;
  mode?: string;
  // Extended profile fields — all optional, null from server = not set
  legal_name?: string;
  bin?: string;
  iin?: string;
  legal_form?: string;
  director?: string;
  accountant?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  bank_name?: string;
  bank_bik?: string;
  bank_account?: string;
  currency: string;
  industry?: string;
  onboarding_completed?: boolean;
}

type SectionKey =
  | 'organization'
  | 'company-access'
  | 'appearance'
  | 'security'
  | 'team'
  | 'integrations'
  | 'webhooks'
  | 'templates'
  | 'api';

const ACCESS_LABELS: Record<string, string> = {
  active: 'Активен',
  pending: 'Ожидает подтверждения',
  rejected: 'Отклонён',
  no_company: 'Без компании',
  anonymous: 'Без авторизации',
};

const SECTIONS: Array<{ key: SectionKey; label: string; icon: JSX.Element }> = [
  { key: 'organization', label: 'Организация', icon: <Building2 size={15} /> },
  { key: 'company-access', label: 'Компания и доступ', icon: <Users size={15} /> },
  { key: 'appearance', label: 'Оформление', icon: <MonitorCog size={15} /> },
  { key: 'security', label: 'Безопасность', icon: <ShieldCheck size={15} /> },
  { key: 'team', label: 'Команда', icon: <Users size={15} /> },
  { key: 'integrations', label: 'Интеграции', icon: <Globe size={15} /> },
  { key: 'webhooks', label: 'Webhooks', icon: <Zap size={15} /> },
  { key: 'templates', label: 'Шаблоны', icon: <MessageSquare size={15} /> },
  { key: 'api', label: 'API токены', icon: <Key size={15} /> },
];

const THEME_PACKS: Array<{ value: ThemePack; title: string; subtitle: string }> = [
  { value: 'neutral', title: 'Neutral Premium', subtitle: 'Сдержанный базовый стиль интерфейса' },
  { value: 'graphite', title: 'Graphite', subtitle: 'Холодный строгий визуальный пакет' },
  { value: 'sand', title: 'Sand', subtitle: 'Тёплый спокойный рабочий стиль' },
  { value: 'obsidian', title: 'Obsidian', subtitle: 'Контрастная ночная палитра' },
  { value: 'enterprise', title: 'Enterprise Hybrid', subtitle: 'Собранный business-режим для команд' },
];

const KZ_LEGAL_FORMS = [
  { value: '', label: 'Выберите форму' },
  { value: 'ТОО', label: 'ТОО — Товарищество с ограниченной ответственностью' },
  { value: 'АО', label: 'АО — Акционерное общество' },
  { value: 'ИП', label: 'ИП — Индивидуальный предприниматель' },
  { value: 'КФ', label: 'КФ — Крестьянское (фермерское) хозяйство' },
  { value: 'ГКП', label: 'ГКП — Государственное казённое предприятие' },
  { value: 'РГП', label: 'РГП — Республиканское государственное предприятие' },
  { value: 'НКО', label: 'НКО — Некоммерческая организация' },
];

function extractInviteToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('token')?.trim() ?? '';
  } catch {
    const matched = trimmed.match(/[?&]token=([^&]+)/);
    return matched ? decodeURIComponent(matched[1]) : trimmed;
  }
}

function OrgSection() {
  const queryClient = useQueryClient();
  const setOrg = useAuthStore((state) => state.setOrg);
  const { data: org } = useQuery<OrgData>({
    queryKey: ['organization'],
    queryFn: () => api.get('/organization/'),
  });
  const { register, handleSubmit } = useForm<Partial<OrgData>>();
  const mutation = useMutation({
    mutationFn: (payload: Partial<OrgData>) => api.patch<OrgData>('/organization/', payload),
    onSuccess: (updated) => {
      if (updated) setOrg(updated as any);
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Организация обновлена');
    },
  });

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>Данные организации</div>
          <div className={s.sectionSubtitle}>Реквизиты используются при формировании счётов, накладных и документов</div>
        </div>
        <Button size="sm" loading={mutation.isPending} onClick={handleSubmit((payload) => mutation.mutate(payload))}>
          Сохранить
        </Button>
      </div>
      <div className={s.sectionBody}>

        {/* — Блок 1: Основные данные — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Основное</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Название компании <span className={s.fieldRequired}>*</span></label>
              <input {...register('name')} defaultValue={org?.name ?? ''} className="kort-input" placeholder="ТОО «Моя Компания»" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Юридическое наименование</label>
              <input {...register('legal_name')} defaultValue={org?.legal_name ?? ''} className="kort-input" placeholder="Полное официальное наименование" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Организационно-правовая форма</label>
              <select {...register('legal_form')} defaultValue={org?.legal_form ?? ''} className={`kort-input ${s.selectInput}`}>
                {KZ_LEGAL_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Отрасль</label>
              <input {...register('industry')} defaultValue={org?.industry ?? ''} className="kort-input" placeholder="Производство / Торговля / Услуги" />
            </div>
          </div>
        </div>

        {/* — Блок 2: Регистрационные данные — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Регистрация и налоги</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>БИН <span className={s.fieldHint}>(12 цифр, для юр. лиц)</span></label>
              <input {...register('bin')} defaultValue={org?.bin ?? ''} className="kort-input" placeholder="000000000000" maxLength={12} inputMode="numeric" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>ИИН <span className={s.fieldHint}>(12 цифр, для ИП)</span></label>
              <input {...register('iin')} defaultValue={org?.iin ?? ''} className="kort-input" placeholder="000000000000" maxLength={12} inputMode="numeric" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Валюта расчётов</label>
              <select {...register('currency')} defaultValue={org?.currency ?? 'KZT'} className={`kort-input ${s.selectInput}`}>
                <option value="KZT">KZT — Казахстанский тенге ₸</option>
                <option value="USD">USD — Доллар США $</option>
                <option value="RUB">RUB — Российский рубль ₽</option>
                <option value="EUR">EUR — Евро €</option>
              </select>
            </div>
          </div>
        </div>

        {/* — Блок 3: Руководство — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Руководство</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Директор / Руководитель</label>
              <input {...register('director')} defaultValue={org?.director ?? ''} className="kort-input" placeholder="ФИО полностью" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Главный бухгалтер</label>
              <input {...register('accountant')} defaultValue={org?.accountant ?? ''} className="kort-input" placeholder="ФИО или «Без бухгалтера»" />
            </div>
          </div>
        </div>

        {/* — Блок 4: Контакты и адрес — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Контакты и адрес</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Город</label>
              <input {...register('city')} defaultValue={org?.city ?? ''} className="kort-input" placeholder="Алматы" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Юридический адрес</label>
              <input {...register('address')} defaultValue={org?.address ?? ''} className="kort-input" placeholder="ул. Абая, 1, офис 100" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Телефон</label>
              <input {...register('phone')} defaultValue={org?.phone ?? ''} className="kort-input" placeholder="+7 (___) ___-__-__" inputMode="tel" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Электронная почта</label>
              <input {...register('email')} defaultValue={org?.email ?? ''} className="kort-input" placeholder="info@company.kz" inputMode="email" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Веб-сайт</label>
              <input {...register('website')} defaultValue={org?.website ?? ''} className="kort-input" placeholder="https://company.kz" />
            </div>
          </div>
        </div>

        {/* — Блок 5: Банковские реквизиты — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Банковские реквизиты</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Банк</label>
              <input {...register('bank_name')} defaultValue={org?.bank_name ?? ''} className="kort-input" placeholder="Казкоммерцбанк / Халык Банк" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>БИК банка</label>
              <input {...register('bank_bik')} defaultValue={org?.bank_bik ?? ''} className="kort-input" placeholder="HSBKKZKX" maxLength={11} />
            </div>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label className={s.fieldLabel}>Расчётный счёт (ИИК)</label>
              <input {...register('bank_account')} defaultValue={org?.bank_account ?? ''} className="kort-input" placeholder="KZ00 0000 0000 0000 0000" maxLength={24} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function CompanyAccessSection() {
  const access = useCompanyAccess();

  return (
    <>
      {/* ── Статус доступа ── */}
      <div className={s.section}>
        <div className={s.sectionHeader}>
          <div>
            <div className={s.sectionTitle}>Статус доступа</div>
            <div className={s.sectionSubtitle}>Компания, роль и текущее состояние участия</div>
          </div>
          <Badge bg="var(--bg-surface-inset)" color="var(--text-secondary)">
            {ACCESS_LABELS[access.state] ?? access.state}
          </Badge>
        </div>
        <div className={s.sectionBody}>
          {access.isAdmin ? (
            <div className={s.adminGateCard}>
              <Building2 size={18} />
              <div>
                <div className={s.adminGateTitle}>Компания активна</div>
                <div className={s.adminGateText}>
                  Вы управляете компанией «{access.companyName ?? 'Текущая организация'}».
                  Сотрудники добавляются в разделе ниже.
                </div>
              </div>
            </div>
          ) : (
            <CompanyAccessGate compact />
          )}

          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Текущая компания</label>
              <div className={s.apiKeyField}>{access.companyName ?? 'Не выбрана'}</div>
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Роль</label>
              <div className={s.apiKeyField}>{access.role ?? 'viewer'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Управление сотрудниками (только для admin/owner) ── */}
      {access.isAdmin && (
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <div>
              <div className={s.sectionTitle}>Сотрудники</div>
              <div className={s.sectionSubtitle}>
                Добавление, права доступа и управление аккаунтами. Сотрудники входят через
                номер телефона при первом визите.
              </div>
            </div>
          </div>
          <div className={s.sectionBody}>
            <EmployeePanel />
          </div>
        </div>
      )}
    </>
  );
}

function TeamSection() {
  const queryClient = useQueryClient();
  const { isAdmin } = useRole();
  const { data: team, isLoading } = useQuery<{ results: TeamMemberResponse[] }>({
    queryKey: ['team'],
    queryFn: () => api.get('/users/team/'),
  });
  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => api.patch(`/users/${userId}/role/`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Роль обновлена');
    },
  });

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>Команда</div>
          <div className={s.sectionSubtitle}>Активные сотрудники компании</div>
        </div>
        <Button size="sm" onClick={() => window.location.assign('/admin/team')}>Приглашения</Button>
      </div>

      <div className={s.teamTableWrap}>
        <table className={s.teamTable}>
          <tbody>
            {isLoading
              ? [1, 2, 3].map((item) => (
                <tr key={item}>
                  <td><Skeleton height={16} /></td>
                </tr>
              ))
              : (team?.results ?? []).map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className={s.memberCell}>
                      <div className={s.memberAvatar}>{member.full_name.charAt(0)}</div>
                      <div>
                        <div className={s.memberName}>{member.full_name}</div>
                        <div className={s.memberEmail}>{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge
                      bg={member.status === 'active' ? 'var(--fill-positive-soft)' : 'var(--bg-surface-inset)'}
                      color={member.status === 'active' ? 'var(--fill-positive-text)' : 'var(--text-secondary)'}
                    >
                      {member.status}
                    </Badge>
                  </td>
                  <td>
                    {isAdmin ? (
                      <select
                        value={member.role ?? 'viewer'}
                        onChange={(event) => setRole.mutate({ userId: member.id, role: event.target.value })}
                        className={`kort-input ${s.roleSelect}`}
                      >
                        <option value="admin">admin</option>
                        <option value="manager">manager</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      <span className={s.roleText}>{member.role ?? 'viewer'}</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AppearanceSection() {
  const themePack = useUIStore((state) => state.themePack);
  const setThemePack = useUIStore((state) => state.setThemePack);

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>Визуальный пакет</div>
          <div className={s.sectionSubtitle}>Меняет только стиль интерфейса, без связи с ландшафтом или SPA-логикой</div>
        </div>
      </div>
      <div className={s.sectionBody}>
        <div className={s.themeModeRow}>
          {THEME_PACKS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`${s.themeModeBtn} ${themePack === item.value ? s.themeModeBtnActive : ''}`}
              onClick={() => setThemePack(item.value)}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className={s.fieldHint}>
          {THEME_PACKS.find((item) => item.value === themePack)?.subtitle}
        </div>
      </div>
    </div>
  );
}

function SecuritySection() {
  const pin = usePinStore((state) => state.pin);
  const isTrustedDevice = usePinStore((state) => state.isTrustedDevice);
  const setPin = usePinStore((state) => state.setPin);
  const clearPin = usePinStore((state) => state.clearPin);
  const [nextPin, setNextPin] = useState('');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>Безопасность входа</div>
          <div className={s.sectionSubtitle}>PIN-код и доверенное устройство</div>
        </div>
      </div>
      <div className={s.sectionBody}>
        <div className={s.securityCard}>
          <div className={s.securityCardIcon}><Smartphone size={18} /></div>
          <div className={s.securityCardBody}>
            <div className={s.securityCardTitle}>Устройство</div>
            <div className={s.securityCardMeta}>ID: {getDeviceId().slice(0, 18)}...</div>
            <div className={s.securityCardStatus}>
              {isTrustedDevice
                ? <span className={s.statusTrusted}>Доверенное устройство</span>
                : <span className={s.statusUntrusted}>Сначала выполните обычный вход</span>}
            </div>
          </div>
        </div>

        <div className={s.securityCard}>
          <div className={s.securityCardIcon}><ShieldCheck size={18} /></div>
          <div className={s.securityCardBody}>
            <div className={s.securityCardTitle}>PIN-код</div>
            <div className={s.securityCardMeta}>{pin ? 'PIN установлен' : 'PIN не установлен'}</div>
            <div className={s.securityActions}>
              <button className={s.securityBtn} onClick={() => setShowForm((state) => !state)}>
                {pin ? 'Изменить PIN' : 'Установить PIN'}
              </button>
              {pin && (
                <button
                  className={`${s.securityBtn} ${s.securityBtnDanger}`}
                  onClick={() => {
                    clearPin();
                    toast.success('PIN удалён');
                  }}
                >
                  Удалить PIN
                </button>
              )}
            </div>
          </div>
        </div>

        {showForm && (
          <div className={s.pinSetupCard}>
            <div className={s.pinSetupFields}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Новый PIN</label>
                <input
                  className="kort-input"
                  inputMode="numeric"
                  maxLength={4}
                  value={nextPin}
                  onChange={(event) => setNextPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </div>
            </div>
            <div className={s.pinSetupActions}>
              <button
                className={s.securityBtn}
                onClick={() => {
                  if (nextPin.length !== 4) {
                    toast.error('PIN должен содержать 4 цифры');
                    return;
                  }
                  setPin(nextPin);
                  setShowForm(false);
                  setNextPin('');
                  toast.success('PIN сохранён');
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ApiSection() {
  const org = useAuthStore((state) => state.org);
  const token = `kort_${org?.slug ?? 'workspace'}_${(org?.id ?? 'org').replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase()}_demo`;

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>API токен</div>
          <div className={s.sectionSubtitle}>Mock-контракт для будущего backend</div>
        </div>
      </div>
      <div className={s.sectionBody}>
        <div className={s.apiKeyRow}>
          <div className={s.apiKeyField}>{token}</div>
          <Button
            size="sm"
            icon={<Copy size={13} />}
            onClick={async () => {
              const copied = await copyToClipboard(token);
              toast[copied ? 'success' : 'error'](copied ? 'Токен скопирован' : 'Не удалось скопировать токен');
            }}
          >
            Копировать
          </Button>
        </div>
      </div>
    </div>
  );
}

function StubSection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>{title}</div>
          <div className={s.sectionSubtitle}>{subtitle}</div>
        </div>
      </div>
      <div className={s.sectionBody}>
        <div className={s.adminGateCard}>
          <MessageSquare size={18} />
          <div>
            <div className={s.adminGateTitle}>Каркас секции сохранён</div>
            <div className={s.adminGateText}>
              Базовая структура уже подготовлена и ждёт подключения полноценного backend API для этой области.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Настройки');
  const params = useParams();
  const navigate = useNavigate();
  const access = useCompanyAccess();
  const capabilities = useCapabilities();

  const visibleSections = useMemo(() => SECTIONS.filter((item) => {
    switch (item.key) {
      case 'company-access':
      case 'appearance':
      case 'security':
        return true;
      case 'organization':
        return access.isAdmin && access.hasCompanyAccess;
      case 'templates':
        return access.hasCompanyAccess;
      case 'team':
        return capabilities.canManageTeam;
      case 'integrations':
        return capabilities.canManageIntegrations;
      case 'webhooks':
        return capabilities.canRunAutomations;
      case 'api':
        return capabilities.canViewAudit;
      default:
        return false;
    }
  }), [access.hasCompanyAccess, access.isAdmin, capabilities.canManageIntegrations, capabilities.canManageTeam, capabilities.canRunAutomations, capabilities.canViewAudit]);

  const requestedSection = (params.section as SectionKey | undefined) ?? 'company-access';
  const defaultSection = visibleSections[0]?.key ?? 'company-access';
  const section = visibleSections.some((item) => item.key === requestedSection) ? requestedSection : defaultSection;
  const sectionKeys = visibleSections.map((item) => item.key);
  const onTabKeyDown = useTabsKeyboardNav(sectionKeys, section, (next) => navigate(next === 'company-access' ? '/settings' : `/settings/${next}`));

  useEffect(() => {
    const expectedPath = section === 'company-access' ? '/settings' : `/settings/${section}`;
    if (`/${params.section ?? ''}` === `/${section}` && params.section) return;
    if (!params.section && section === 'company-access') return;
    navigate(expectedPath, { replace: true });
  }, [navigate, params.section, section]);

  return (
    <div className={s.page}>
      <PageHeader
        title="Настройки"
        subtitle="Организация, доступы, безопасность и подготовка к backend"
      />

      <div className={s.navTabs} role="tablist" aria-label="Разделы настроек" onKeyDown={onTabKeyDown}>
        {visibleSections.map((item) => (
          <button
            key={item.key}
            role="tab"
            tabIndex={section === item.key ? 0 : -1}
            aria-selected={section === item.key}
            className={`${s.navTab} ${section === item.key ? s.active : ''}`}
            onClick={() => navigate(item.key === 'company-access' ? '/settings' : `/settings/${item.key}`)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          {section === 'organization' && <OrgSection />}
          {section === 'company-access' && <CompanyAccessSection />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'team' && <TeamSection />}
          {section === 'api' && <ApiSection />}
          {section === 'integrations' && <StubSection title="Интеграции" subtitle="Каталог внешних подключений и ключей" />}
          {section === 'webhooks' && <StubSection title="Webhooks" subtitle="Доставка событий и автоматизации" />}
          {section === 'templates' && <StubSection title="Шаблоны сообщений" subtitle="Повторно используемые тексты и follow-up сценарии" />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
