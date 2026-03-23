import { useState } from 'react';
import { Flag, X, User, AlertTriangle } from 'lucide-react';
import {
  useProductionTasks, useWorkshopTasks,
  useUpdateProductionStatus, useAssignWorker, useFlagTask, useUnflagTask,
} from '../../../../entities/order/queries';
import { useChapanCatalogs } from '../../../../entities/order/queries';
import type { ProductionTask, ProductionStatus, Priority } from '../../../../entities/order/types';
import styles from './ChapanProduction.module.css';

// ── Constants ────────────────────────────────────────────────────────────────

const STAGES: { key: ProductionStatus; label: string }[] = [
  { key: 'pending',       label: 'Ожидание' },
  { key: 'cutting',       label: 'Раскрой' },
  { key: 'sewing',        label: 'Пошив' },
  { key: 'finishing',     label: 'Отделка' },
  { key: 'quality_check', label: 'Контроль' },
  { key: 'done',          label: 'Готово' },
];

const STAGE_NEXT: Partial<Record<ProductionStatus, ProductionStatus>> = {
  pending:       'cutting',
  cutting:       'sewing',
  sewing:        'finishing',
  finishing:     'quality_check',
  quality_check: 'done',
};

const PRIORITY_DOT: Record<Priority, string> = {
  normal: 'transparent',
  urgent: '#D94F4F',
  vip:    '#C9A84C',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChapanProductionPage() {
  const [view, setView] = useState<'manager' | 'workshop'>('manager');
  const [flagModal, setFlagModal] = useState<{ taskId: string } | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [assignModal, setAssignModal] = useState<{ taskId: string } | null>(null);

  const { data: managerData, isLoading: managerLoading } = useProductionTasks();
  const { data: workshopData, isLoading: workshopLoading } = useWorkshopTasks();
  const { data: catalogs } = useChapanCatalogs();

  const updateStatus = useUpdateProductionStatus();
  const assignWorker = useAssignWorker();
  const flagTask = useFlagTask();
  const unflagTask = useUnflagTask();

  const isLoading = view === 'manager' ? managerLoading : workshopLoading;
  const rawTasks = view === 'manager' ? managerData?.results : workshopData?.results;
  const tasks: ProductionTask[] = rawTasks ?? [];

  const byStage = (key: ProductionStatus) =>
    tasks.filter(t => t.status === key);

  async function handleFlag() {
    if (!flagModal || !flagReason.trim()) return;
    await flagTask.mutateAsync({ taskId: flagModal.taskId, reason: flagReason.trim() });
    setFlagModal(null);
    setFlagReason('');
  }

  async function handleAssign(taskId: string, worker: string) {
    await assignWorker.mutateAsync({ taskId, worker });
    setAssignModal(null);
  }

  const workers = catalogs?.workers ?? [];

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Производство</h1>
        <div className={styles.viewSwitch}>
          <button
            className={`${styles.switchBtn} ${view === 'manager' ? styles.switchActive : ''}`}
            onClick={() => setView('manager')}
          >
            Менеджер
          </button>
          <button
            className={`${styles.switchBtn} ${view === 'workshop' ? styles.switchActive : ''}`}
            onClick={() => setView('workshop')}
          >
            Цех
          </button>
        </div>
      </div>

      {view === 'workshop' && (
        <div className={styles.workshopNote}>
          Цеховой вид — данные клиентов скрыты
        </div>
      )}

      {/* Stats strip */}
      {!isLoading && tasks.length > 0 && (
        <div className={styles.statsStrip}>
          {STAGES.map(s => {
            const count = byStage(s.key).length;
            const blocked = byStage(s.key).filter(t => t.isBlocked).length;
            return (
              <div key={s.key} className={styles.statItem}>
                <span className={styles.statCount}>{count}</span>
                <span className={styles.statLabel}>{s.label}</span>
                {blocked > 0 && <span className={styles.statBlocked}>⚑ {blocked}</span>}
              </div>
            );
          })}
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <div className={styles.emptyState}>
          <div>🏭</div>
          <div>Нет активных производственных заданий</div>
        </div>
      )}

      {!isLoading && tasks.length > 0 && (
        <div className={styles.kanban}>
          {STAGES.map(stage => {
            const stageTasks = byStage(stage.key);
            return (
              <div key={stage.key} className={styles.column}>
                <div className={styles.colHeader}>
                  <span className={styles.colLabel}>{stage.label}</span>
                  <span className={styles.colCount}>{stageTasks.length}</span>
                </div>
                <div className={styles.colCards}>
                  {stageTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      stageKey={stage.key}
                      isManagerView={view === 'manager'}
                      onMoveForward={() => {
                        const next = STAGE_NEXT[stage.key];
                        if (next) updateStatus.mutate({ taskId: task.id, status: next });
                      }}
                      onFlag={() => {
                        setFlagModal({ taskId: task.id });
                        setFlagReason('');
                      }}
                      onUnflag={() => unflagTask.mutate(task.id)}
                      onAssign={() => setAssignModal({ taskId: task.id })}
                      priorityDot={PRIORITY_DOT[task.order.priority]}
                    />
                  ))}
                  {stageTasks.length === 0 && (
                    <div className={styles.colEmpty}>—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Flag modal */}
      {flagModal && (
        <div className={styles.modalOverlay} onClick={() => setFlagModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Заблокировать задание</span>
              <button className={styles.modalClose} onClick={() => setFlagModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.modalLabel}>Причина блокировки</label>
              <input
                className={styles.modalInput}
                value={flagReason}
                onChange={e => setFlagReason(e.target.value)}
                placeholder="Нет ткани, дефект материала..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleFlag()}
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setFlagModal(null)}>
                Отмена
              </button>
              <button
                className={styles.modalSubmit}
                onClick={handleFlag}
                disabled={!flagReason.trim() || flagTask.isPending}
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className={styles.modalOverlay} onClick={() => setAssignModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Назначить исполнителя</span>
              <button className={styles.modalClose} onClick={() => setAssignModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.workerList}>
              {workers.length === 0 ? (
                <div className={styles.noWorkers}>
                  Добавьте работников в настройках Чапан
                </div>
              ) : (
                workers.map(w => (
                  <button
                    key={w}
                    className={styles.workerBtn}
                    onClick={() => handleAssign(assignModal.taskId, w)}
                  >
                    <User size={13} />
                    {w}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: ProductionTask;
  stageKey: ProductionStatus;
  isManagerView: boolean;
  onMoveForward: () => void;
  onFlag: () => void;
  onUnflag: () => void;
  onAssign: () => void;
  priorityDot: string;
}

function TaskCard({
  task, stageKey, isManagerView,
  onMoveForward, onFlag, onUnflag, onAssign, priorityDot,
}: TaskCardProps) {
  const isDone = stageKey === 'done';

  return (
    <div className={`${styles.taskCard} ${task.isBlocked ? styles.taskBlocked : ''} ${isDone ? styles.taskDone : ''}`}>
      {/* Block banner */}
      {task.isBlocked && task.blockReason && (
        <div className={styles.blockBanner}>
          <AlertTriangle size={11} />
          {task.blockReason}
        </div>
      )}

      {/* Order number + priority dot */}
      <div className={styles.taskHead}>
        <span
          className={styles.taskOrderNum}
          style={{ borderLeftColor: priorityDot !== 'transparent' ? priorityDot : 'rgba(255,255,255,.1)' }}
        >
          #{task.order.orderNumber}
        </span>
        {task.order.priority !== 'normal' && (
          <span
            className={styles.taskPriority}
            style={{ color: priorityDot }}
          >
            {task.order.priority === 'urgent' ? '🔴' : '⭐'}
          </span>
        )}
        {isManagerView && task.order.clientName && (
          <span className={styles.taskClient}>{task.order.clientName.split(' ')[0]}</span>
        )}
      </div>

      {/* Product info */}
      <div className={styles.taskProduct}>{task.productName}</div>
      <div className={styles.taskMeta}>
        {[task.fabric, task.size].filter(Boolean).join(' · ')}
        {task.quantity > 1 && ` × ${task.quantity}`}
      </div>

      {/* Worker */}
      <div className={styles.taskWorker}>
        <button className={styles.workerChip} onClick={onAssign}>
          <User size={11} />
          {task.assignedTo ?? 'Не назначен'}
        </button>
        {task.order.dueDate && (
          <span className={styles.taskDeadline}>
            {new Date(task.order.dueDate).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>

      {/* Actions */}
      {!isDone && (
        <div className={styles.taskActions}>
          {!task.isBlocked && (
            <button className={styles.nextBtn} onClick={onMoveForward}>
              → {STAGES[STAGES.findIndex(s => s.key === stageKey) + 1]?.label ?? '✓'}
            </button>
          )}
          {task.isBlocked ? (
            <button className={styles.unflagBtn} onClick={onUnflag}>
              Снять блок
            </button>
          ) : (
            <button className={styles.flagBtn} onClick={onFlag}>
              <Flag size={11} />
            </button>
          )}
        </div>
      )}
      {isDone && (
        <div className={styles.doneLabel}>✓ Готово</div>
      )}
    </div>
  );
}
