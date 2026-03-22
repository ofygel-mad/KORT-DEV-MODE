/**
 * ChapanEntry — entry point for the «Производство» tile.
 *
 * Flow:
 *   hub  →  [ Чапан / Новый шаблон ]
 *              ↓                ↓
 *           ChapanSPA     ProductionTemplateSPA
 *           (production   (template editor)
 *            kanban)
 *
 * Manager-side sections (Заявки, Заказы, Настройки) have been
 * moved to the separate «Заявки» tile (RequestsSPA).
 * All authenticated roles see the production kanban here.
 */
import { Lock } from 'lucide-react';
import { ChapanSPA } from './ChapanSPA';
import { WorkshopConsole } from '../../../../chapan-spa/components/workshop/WorkshopConsole';
import { useChapanStore } from '../../../../chapan-spa/model/chapan.store';
import {
  canSeeWorkshopConsole,
  useResolvedChapanRole,
} from '../../../../chapan-spa/model/rbac.store';
import { ProductionHub } from './ProductionHub';
import { ProductionTemplateSPA } from './ProductionTemplateSPA';
import { ProductionWorkspaceShell } from './ProductionWorkspaceShell';
import { useTileProductionShell } from './production-shell.store';
import s from './ChapanEntry.module.css';

export function ChapanEntry({ tileId }: { tileId: string }) {
  const role = useResolvedChapanRole();
  const { activeWorkspace, goHome, templateName } = useTileProductionShell(tileId);
  const profileName = useChapanStore((state) => state.profile.displayName);
  const templateTitle = templateName.trim() || 'Новое производство';

  /* ── Hub (card grid: Чапан + Шаблон) ─────────────────── */
  if (activeWorkspace === 'hub') {
    return <ProductionHub tileId={tileId} />;
  }

  /* ── Template workspace ───────────────────────────────── */
  if (activeWorkspace === 'template') {
    return (
      <ProductionWorkspaceShell
        title={templateTitle}
        onBack={goHome}
        tone="template"
      >
        <ProductionTemplateSPA tileId={tileId} onBack={goHome} />
      </ProductionWorkspaceShell>
    );
  }

  /* ── Chapan production workspace ─────────────────────── */
  // workshop_lead / worker → personalised WorkshopConsole
  if (canSeeWorkshopConsole(role)) {
    return (
      <ProductionWorkspaceShell
        title={profileName}
        onBack={goHome}
        tone="live"
      >
        <WorkshopConsole title={profileName} onBack={goHome} />
      </ProductionWorkspaceShell>
    );
  }

  // manager / any other role → production kanban (ChapanSPA, production-only)
  // Managers use the «Заявки» tile for order management.
  if (role !== 'viewer') {
    return (
      <ProductionWorkspaceShell
        title={profileName}
        onBack={goHome}
        tone="live"
      >
        <ChapanSPA tileId={tileId} title={profileName} onBack={goHome} />
      </ProductionWorkspaceShell>
    );
  }

  /* ── Access denied ────────────────────────────────────── */
  return (
    <ProductionWorkspaceShell
      title={profileName}
      onBack={goHome}
      tone="locked"
    >
      <div className={s.denied}>
        <div className={s.iconWrap}>
          <Lock size={20} />
        </div>
        <div className={s.title}>Доступ к производственному пространству ограничен</div>
        <div className={s.text}>
          Обратитесь к администратору компании и назначьте роль внутри выбранного производства.
        </div>
      </div>
    </ProductionWorkspaceShell>
  );
}
