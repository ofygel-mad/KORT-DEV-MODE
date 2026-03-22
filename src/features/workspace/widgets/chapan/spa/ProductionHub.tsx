import { useEffect, useRef } from 'react';
import { ArrowRight, Factory, FileStack, RefreshCw } from 'lucide-react';
import { useChapanStore } from '../../../../chapan-spa/model/chapan.store';
import { useTileProductionShell } from './production-shell.store';
import s from './ProductionHub.module.css';

export function ProductionHub({ tileId }: { tileId: string }) {
  const { loading, load, profile } = useChapanStore();
  const { openWorkspace, templateName } = useTileProductionShell(tileId);
  const hasRequestedInitialLoad = useRef(false);
  const templateTitle = templateName.trim() || 'Новое производство';

  useEffect(() => {
    if (!hasRequestedInitialLoad.current && !loading) {
      hasRequestedInitialLoad.current = true;
      void load();
    }
  }, [load, loading]);

  if (loading) {
    return (
      <div className={s.loading}>
        <RefreshCw size={18} className={s.spin} />
        <span>Загрузка...</span>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <span className={s.eyebrow}>Выберите пространство</span>
      </div>

      <div className={s.list}>

        {/* ── Действующее производство ── */}
        <button
          className={s.entry}
          data-tone="live"
          onClick={() => openWorkspace('chapan')}
        >
          <span className={s.entryIcon}>
            <Factory size={20} strokeWidth={1.6} />
          </span>
          <span className={s.entryBody}>
            <span className={s.entryLabel}>Действующее производство</span>
            <strong className={s.entryTitle}>{profile.displayName}</strong>
          </span>
          <span className={s.entryArrow}>
            <ArrowRight size={16} />
          </span>
        </button>

        {/* ── Шаблон ── */}
        <button
          className={s.entry}
          data-tone="template"
          onClick={() => openWorkspace('template')}
        >
          <span className={s.entryIcon}>
            <FileStack size={20} strokeWidth={1.6} />
          </span>
          <span className={s.entryBody}>
            <span className={s.entryLabel}>Шаблон</span>
            <strong className={s.entryTitle}>{templateTitle}</strong>
          </span>
          <span className={s.entryArrow}>
            <ArrowRight size={16} />
          </span>
        </button>

      </div>
    </div>
  );
}
