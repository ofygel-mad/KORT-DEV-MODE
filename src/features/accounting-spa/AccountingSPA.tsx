/**
 * features/accounting-spa/AccountingSPA.tsx
 *
 * Root SPA component rendered inside a workspace tile.
 * Tabs: Журнал | P&L | Движение ДС | Склад | Долги | Разрывы
 */

import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, TrendingUp, BarChart2, Package,
  Users, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAccountingStore, type AccountingView } from './model/store';
import { accountingApi } from './api/client';
import { SummaryBar } from './ui/SummaryBar/SummaryBar';
import { LedgerView }    from './views/LedgerView';
import { PnLView }       from './views/PnLView';
import { CashFlowView }  from './views/CashFlowView';
import { InventoryView } from './views/InventoryView';
import { DebtView }      from './views/DebtView';
import { GapsView }      from './views/GapsView';
import s from './AccountingSPA.module.css';

// ─────────────────────────────────────────────────────────────
//  Tab config
// ─────────────────────────────────────────────────────────────

interface TabDef {
  id: AccountingView;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: 'ledger',    label: 'Журнал',   Icon: BookOpen },
  { id: 'pnl',      label: 'P&L',      Icon: TrendingUp },
  { id: 'cashflow', label: 'Движение ДС', Icon: BarChart2 },
  { id: 'inventory',label: 'Склад',    Icon: Package },
  { id: 'debts',    label: 'Долги',    Icon: Users },
  { id: 'gaps',     label: 'Разрывы',  Icon: AlertTriangle },
];

// ─────────────────────────────────────────────────────────────
//  SPA
// ─────────────────────────────────────────────────────────────

interface Props {
  tileId: string;
  onBack?: () => void;
}

export function AccountingSPA({ tileId, onBack }: Props) {
  const { view, setView, filters } = useAccountingStore();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['accounting-summary', filters.period],
    queryFn: () => accountingApi.getSummary(filters.period),
    refetchInterval: 60_000,
  });

  const hasGaps = (summary?.openGaps ?? 0) > 0;

  return (
    <div className={s.root}>
      {/* Top bar */}
      <div className={s.topBar}>
        {onBack && (
          <button className={s.backBtn} onClick={onBack}>
            <ArrowLeft size={15} />
          </button>
        )}
        <div className={s.titleWrap}>
          <span className={s.title}>Учёт и Аудит</span>
          <span className={s.period}>{filters.period}</span>
        </div>
      </div>

      {/* KPI Strip */}
      <SummaryBar data={summary} loading={summaryLoading} />

      {/* Tab nav */}
      <div className={s.tabs}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`${s.tab} ${view === id ? s.tabActive : ''} ${id === 'gaps' && hasGaps ? s.tabAlert : ''}`}
            onClick={() => setView(id)}
          >
            <Icon size={14} strokeWidth={1.8} />
            <span>{label}</span>
            {id === 'gaps' && hasGaps && (
              <span className={s.gapPill}>{summary?.openGaps}</span>
            )}
          </button>
        ))}
      </div>

      {/* View content */}
      <div className={s.content}>
        {view === 'ledger'    && <LedgerView />}
        {view === 'pnl'      && <PnLView />}
        {view === 'cashflow' && <CashFlowView />}
        {view === 'inventory' && <InventoryView />}
        {view === 'debts'    && <DebtView />}
        {view === 'gaps'     && <GapsView />}
      </div>
    </div>
  );
}

export default AccountingSPA;
