import type { LucideIcon } from 'lucide-react';
import { Briefcase, CheckSquare, Users, Archive, Layers, User } from 'lucide-react';
import type { WorkspaceWidgetKind } from './model/types';

export interface WorkspaceWidgetDefinition {
  kind: WorkspaceWidgetKind;
  title: string;
  description: string;
  icon: LucideIcon;
  navTo: string;
  color: string;
}

export const WORKSPACE_WIDGETS: WorkspaceWidgetDefinition[] = [
  {
    kind: 'leads',
    title: 'Лиды',
    description: 'CRM воронка — квалификация и конвертация лидов.',
    icon: Users,
    navTo: '/crm/leads',
    color: 'var(--fill-info)',
  },
  {
    kind: 'deals',
    title: 'Сделки',
    description: 'Воронка сделок: встречи, КП, договоры, оплаты.',
    icon: Briefcase,
    navTo: '/crm/deals',
    color: 'var(--fill-accent)',
  },
  {
    kind: 'tasks',
    title: 'Задачи',
    description: 'Управление задачами — список, статусы, дедлайны.',
    icon: CheckSquare,
    navTo: '/crm/tasks',
    color: 'var(--fill-positive)',
  },
  {
    kind: 'customers',
    title: 'Клиенты',
    description: 'База клиентов с историей взаимодействий.',
    icon: User,
    navTo: '/crm/customers',
    color: 'var(--fill-info)',
  },
  {
    kind: 'warehouse',
    title: 'Склад',
    description: 'Остатки, движения, алерты по минимуму.',
    icon: Archive,
    navTo: '/warehouse',
    color: '#8B6914',
  },
  {
    kind: 'chapan',
    title: 'Производство',
    description: 'Приём заказов, производство, передача.',
    icon: Layers,
    navTo: '/workzone/chapan',
    color: '#C9A84C',
  },
];

export const WORKSPACE_WIDGET_MAP = Object.fromEntries(
  WORKSPACE_WIDGETS.map((w) => [w.kind, w]),
) as Record<WorkspaceWidgetKind, WorkspaceWidgetDefinition>;
