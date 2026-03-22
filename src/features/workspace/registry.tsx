import type { LucideIcon } from 'lucide-react';
import { Archive, Briefcase, CheckSquare, DatabaseZap, FolderInput, Inbox, Users, Factory } from 'lucide-react';
import type { WorkspaceSnapshot, WorkspaceWidgetKind } from './model/types';

// Tile previews
import { LeadsTilePreview }      from './widgets/customers/LeadsTilePreview';
import { DealsTilePreview }      from './widgets/deals/DealsTilePreview';
import { TasksTilePreview }      from './widgets/tasks/TasksTilePreview';
import { ReportsTilePreview }    from './widgets/reports/ReportsTilePreview';
import { ImportsTilePreview }    from './widgets/imports/ImportsTilePreview';
import { ChapanTilePreview }     from './widgets/chapan/ChapanTilePreview';
import { RequestsTilePreview }   from './widgets/requests/RequestsTilePreview';
import { WarehouseTilePreview }  from './widgets/warehouse/WarehouseTilePreview';

// Full SPA environments
import { LeadsSPA }      from '../leads-spa';
import { DealsSPA }      from '../deals-spa';
import { TasksSPA }      from './widgets/tasks/spa/TasksSPA';
import { ReportsSPA }    from './widgets/reports/spa/ReportsSPA';
import { ImportsSPA }    from './widgets/imports/spa/ImportsSPA';
import { ChapanEntry }   from './widgets/chapan/spa/ChapanEntry';
import { RequestsSPA }   from './widgets/requests/spa/RequestsSPA';
import { WarehouseSPA }  from '../warehouse-spa';

export interface WorkspaceWidgetDefinition {
  kind: WorkspaceWidgetKind;
  title: string;
  description: string;
  requiresCompanyAccess: boolean;
  icon: LucideIcon;
  renderPreview: (snapshot?: WorkspaceSnapshot, version?: number, tileId?: string) => JSX.Element;
  renderSPA:     (snapshot?: WorkspaceSnapshot, version?: number, tileId?: string) => JSX.Element;
}

export const WORKSPACE_WIDGETS: WorkspaceWidgetDefinition[] = [
  {
    kind: 'customers',
    title: 'Лиды',
    description: 'CRM воронка: квалификация, передача и закрытие лидов.',
    requiresCompanyAccess: true,
    icon: Users,
    renderPreview: (_s, v, tid) => <LeadsTilePreview key={v} tileId={tid ?? 'default'} />,
    renderSPA:     (_s, v, tid) => <LeadsSPA key={v} tileId={tid ?? 'default'} />,
  },
  {
    kind: 'deals',
    title: 'Сделки',
    description: 'Воронка сделок: встречи, КП, договоры, оплаты.',
    requiresCompanyAccess: true,
    icon: Briefcase,
    renderPreview: (_s, v, tid) => <DealsTilePreview key={v} tileId={tid ?? 'default'} />,
    renderSPA:     (_s, v, tid) => <DealsSPA key={v} tileId={tid ?? 'default'} />,
  },
  {
    kind: 'tasks',
    title: 'Задачи',
    description: 'Локальный центр контроля задач. Можно создать сколько угодно копий.',
    requiresCompanyAccess: true,
    icon: CheckSquare,
    renderPreview: (s, v, tid) => <TasksTilePreview key={v} snapshot={s} tileId={tid ?? 'default'} />,
    renderSPA:     (_s, v, tid) => <TasksSPA key={v} tileId={tid ?? 'default'} />,
  },
  {
    kind: 'reports',
    title: 'Сводка',
    description: 'Компактная метрика для тех, кому нужно видеть только нерв системы.',
    requiresCompanyAccess: true,
    icon: DatabaseZap,
    renderPreview: (s, v) => <ReportsTilePreview key={v} snapshot={s} />,
    renderSPA:     (s, v) => <ReportsSPA key={v} snapshot={s} />,
  },
  {
    kind: 'imports',
    title: 'Импорт',
    description: 'Центр загрузки, маппинга и синхронизации данных.',
    requiresCompanyAccess: true,
    icon: FolderInput,
    renderPreview: (_s, v) => <ImportsTilePreview key={v} />,
    renderSPA:     (_s, v, tid) => <ImportsSPA key={v} tileId={tid ?? 'default'} />,
  },
  {
    kind: 'requests',
    title: 'Заявки',
    description: 'Менеджерский центр: входящие заявки, оформление заказов, оплата и настройки мастерской.',
    requiresCompanyAccess: true,
    icon: Inbox,
    renderPreview: (_s, v, tid) => <RequestsTilePreview key={v} tileId={tid ?? 'default'} />,
    renderSPA:     (_s, v, tid) => <RequestsSPA key={v} tileId={tid ?? 'default'} />,
  },
  {
    kind: 'chapan',
    title: 'Производство',
    description: 'Цеховой канбан: производственные задания, распределение по исполнителям, контроль блокировок.',
    requiresCompanyAccess: true,
    icon: Factory,
    renderPreview: (_s, v, tid) => <ChapanTilePreview key={v} tileId={tid ?? 'default'} />,
    renderSPA:     (_s, v, tid) => <ChapanEntry key={v} tileId={tid ?? 'default'} />,
  },
  {
    kind: 'warehouse',
    title: 'Склад',
    description: 'Остатки, движения, резервы. Автоматически проверяет запасы под заказы производства и сигнализирует при нехватке.',
    requiresCompanyAccess: true,
    icon: Archive,
    renderPreview: (_s, v, tid) => <WarehouseTilePreview key={v} tileId={tid ?? 'default'} />,
    renderSPA:     (_s, v, tid) => <WarehouseSPA key={v} tileId={tid ?? 'default'} />,
  },
];

export const WORKSPACE_WIDGET_MAP = Object.fromEntries(
  WORKSPACE_WIDGETS.map((w) => [w.kind, w]),
) as Record<WorkspaceWidgetKind, WorkspaceWidgetDefinition>;
