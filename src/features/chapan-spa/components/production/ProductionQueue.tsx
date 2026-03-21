import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Package,
  Star,
  Unlock,
  User,
  X,
} from 'lucide-react';
import { IconButton } from '@/shared/ui/IconButton';
import { useChapanStore } from '../../model/chapan.store';
import type { Order, ProductionStatus, ProductionTask, UITone } from '../../api/types';
import {
  PRIORITY_TONE,
  PRODUCTION_STATUS_LABEL,
  PRODUCTION_STATUS_ORDER,
  PRODUCTION_STATUS_TONE,
} from '../../api/types';
import { useHorizontalBoardNav } from '../shared/useHorizontalBoardNav';
import s from './ProductionQueue.module.css';

const PRIORITY_WEIGHT: Record<string, number> = { vip: 0, urgent: 1, normal: 2 };

const TONE_CLASS: Record<UITone, string> = {
  muted: s.toneMuted,
  info: s.toneInfo,
  warning: s.toneWarning,
  danger: s.toneDanger,
  success: s.toneSuccess,
  accent: s.toneAccent,
};

function sortTasks(tasks: ProductionTask[], orderMap: Map<string, Order>): ProductionTask[] {
  return [...tasks].sort((a, b) => {
    const orderA = orderMap.get(a.orderId);
    const orderB = orderMap.get(b.orderId);

    if (a.isBlocked !== b.isBlocked) return a.isBlocked ? -1 : 1;

    const priorityA = PRIORITY_WEIGHT[orderA?.priority ?? 'normal'];
    const priorityB = PRIORITY_WEIGHT[orderB?.priority ?? 'normal'];
    if (priorityA !== priorityB) return priorityA - priorityB;

    const now = Date.now();
    const overdueA = orderA?.dueDate ? new Date(orderA.dueDate).getTime() < now : false;
    const overdueB = orderB?.dueDate ? new Date(orderB.dueDate).getTime() < now : false;
    if (overdueA !== overdueB) return overdueA ? -1 : 1;

    const dueA = orderA?.dueDate ? new Date(orderA.dueDate).getTime() : Infinity;
    const dueB = orderB?.dueDate ? new Date(orderB.dueDate).getTime() : Infinity;
    return dueA - dueB;
  });
}

interface BlockModalState {
  taskId: string;
  productName: string;
  reason: string;
}

interface Props {
  mode?: 'manager' | 'workshop_lead' | 'worker';
}

export function ProductionQueue({ mode = 'manager' }: Props) {
  const {
    orders,
    moveProductionStatus,
    assignWorker,
    flagTask,
    unflagTask,
    setTaskDefect,
    workers,
  } = useChapanStore();

  const canAssign = mode === 'manager' || mode === 'workshop_lead';
  const canResolveBlock = mode === 'manager' || mode === 'workshop_lead';

  const [blockModal, setBlockModal] = useState<BlockModalState | null>(null);
  const [defectInputs, setDefectInputs] = useState<Record<string, string>>({});

  const { allTasks, orderMap } = useMemo(() => {
    const tasks: ProductionTask[] = [];
    const map = new Map<string, Order>();
    for (const order of orders) {
      map.set(order.id, order);
      if (order.status === 'cancelled' || order.status === 'completed') continue;
      tasks.push(...order.productionTasks);
    }
    return { allTasks: tasks, orderMap: map };
  }, [orders]);

  const unassignedCount = allTasks.filter((task) => !task.assignedTo && task.status !== 'done').length;
  const blockedCount = allTasks.filter((task) => task.isBlocked).length;

  const columns = useMemo(() => {
    const cols: Record<ProductionStatus, ProductionTask[]> = {
      pending: [],
      cutting: [],
      sewing: [],
      finishing: [],
      quality_check: [],
      done: [],
    };

    for (const task of allTasks) cols[task.status].push(task);
    for (const status of Object.keys(cols) as ProductionStatus[]) cols[status] = sortTasks(cols[status], orderMap);
    return cols;
  }, [allTasks, orderMap]);

  const {
    viewportRef,
    canScrollLeft,
    canScrollRight,
    scrollLeft,
    scrollRight,
    handleViewportKeyDown,
  } = useHorizontalBoardNav({
    deps: [allTasks.length, blockedCount, unassignedCount],
    step: 320,
  });

  const handleBlockConfirm = async () => {
    if (!blockModal || !blockModal.reason.trim()) return;
    await flagTask(blockModal.taskId, blockModal.reason.trim());
    setBlockModal(null);
  };

  const handleDefectSave = async (taskId: string) => {
    const value = defectInputs[taskId] ?? '';
    await setTaskDefect(taskId, value);
    setDefectInputs((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  if (allTasks.length === 0) {
    return (
      <div className={s.empty}>
        <Package size={32} className={s.emptyIcon} />
        <div className={s.emptyTitle}>Нет задач в производстве</div>
        <div className={s.emptySub}>Подтвердите заказ, чтобы создать производственные задачи</div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      {(unassignedCount > 0 || blockedCount > 0) && (
        <div className={s.banners}>
          {blockedCount > 0 && (
            <div className={`${s.banner} ${s.bannerWarning}`}>
              <AlertTriangle size={13} />
              <span><strong>{blockedCount} задач заблокированы</strong> и требуют решения</span>
            </div>
          )}
          {unassignedCount > 0 && (
            <div className={`${s.banner} ${s.bannerMuted}`}>
              <User size={13} />
              <span>{unassignedCount} задач без исполнителя</span>
            </div>
          )}
        </div>
      )}

      <div className={s.boardToolbar}>
        <div className={s.boardToolbarText}>
          <span className={s.boardToolbarTitle}>Лента этапов</span>
          <span className={s.boardToolbarHint}>Прокрутка стрелками или клавишами ← →</span>
        </div>

        <div className={s.boardToolbarActions}>
          <IconButton
            icon={<ChevronLeft size={16} />}
            label="Прокрутить производственный канбан влево"
            variant="ghost"
            disabled={!canScrollLeft}
            onClick={scrollLeft}
            className={s.scrollBtn}
          />
          <IconButton
            icon={<ChevronRight size={16} />}
            label="Прокрутить производственный канбан вправо"
            variant="ghost"
            disabled={!canScrollRight}
            onClick={scrollRight}
            className={s.scrollBtn}
          />
        </div>
      </div>

      <div
        ref={viewportRef}
        className={s.boardViewport}
        tabIndex={0}
        onKeyDown={handleViewportKeyDown}
        aria-label="Канбан производства"
      >
        <div className={s.board}>
          {PRODUCTION_STATUS_ORDER.map((status) => {
            const tasks = columns[status];
            return (
              <div key={status} className={s.column}>
                <div className={s.colHeader}>
                  <span className={`${s.colDot} ${TONE_CLASS[PRODUCTION_STATUS_TONE[status]]}`} />
                  <span className={s.colTitle}>{PRODUCTION_STATUS_LABEL[status]}</span>
                  <span className={s.colCount}>{tasks.length}</span>
                </div>

                <div className={s.colBody}>
                  {tasks.map((task) => {
                    const parentOrder = orderMap.get(task.orderId);
                    const isOverdue = Boolean(
                      parentOrder?.dueDate
                        && new Date(parentOrder.dueDate) < new Date()
                        && parentOrder.status !== 'completed',
                    );

                    return (
                      <div
                        key={task.id}
                        className={[
                          s.card,
                          isOverdue ? s.cardOverdue : '',
                          parentOrder?.priority === 'vip' ? s.cardVip : '',
                          task.isBlocked ? s.cardBlocked : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <div className={s.cardTop}>
                          <span className={s.cardOrder}>{task.orderNumber}</span>
                          {parentOrder && parentOrder.priority !== 'normal' && (
                            <span className={`${s.cardPriority} ${TONE_CLASS[PRIORITY_TONE[parentOrder.priority]]}`}>
                              {parentOrder.priority === 'vip' ? <Star size={10} /> : <AlertTriangle size={10} />}
                            </span>
                          )}
                          {task.isBlocked && (
                            <span className={`${s.blockedBadge} ${s.toneWarning}`}>
                              <Lock size={9} />
                              Блок
                            </span>
                          )}
                        </div>

                        <div className={s.cardName}>{task.productName}</div>
                        <div className={s.cardMeta}>
                          {task.fabric} / {task.size} / ×{task.quantity}
                        </div>

                        {task.isBlocked && task.blockReason && (
                          <div className={s.blockReason}>
                            <AlertCircle size={10} />
                            {task.blockReason}
                          </div>
                        )}

                        {task.defects && (
                          <div className={s.defectNote}>
                            <AlertTriangle size={10} />
                            {task.defects}
                          </div>
                        )}

                        <div className={s.cardWorkerRow}>
                          {task.assignedTo && (
                            <span className={s.cardWorker}>
                              <User size={10} />
                              {task.assignedTo}
                            </span>
                          )}
                          {canAssign ? (
                            <select
                              className={s.assignSelect}
                              value={task.assignedTo ?? ''}
                              onChange={(event) => assignWorker(task.id, event.target.value)}
                              title="Сменить исполнителя"
                            >
                              <option value="">{task.assignedTo ? 'Сменить...' : 'Назначить...'}</option>
                              {workers.map((worker) => (
                                <option key={worker} value={worker}>{worker}</option>
                              ))}
                            </select>
                          ) : (
                            !task.assignedTo && <span className={s.cardWorker}>Исполнитель не назначен</span>
                          )}
                        </div>

                        {task.status !== 'done' && (
                          <div className={s.cardActions}>
                            {!task.isBlocked && PRODUCTION_STATUS_ORDER
                              .filter((nextStatus) => PRODUCTION_STATUS_ORDER.indexOf(nextStatus) === PRODUCTION_STATUS_ORDER.indexOf(task.status) + 1)
                              .map((nextStatus) => (
                                <button
                                  key={nextStatus}
                                  className={s.moveBtn}
                                  onClick={() => moveProductionStatus(task.id, nextStatus)}
                                >
                                  Перевести: {PRODUCTION_STATUS_LABEL[nextStatus]}
                                </button>
                              ))}

                            {task.isBlocked && canResolveBlock ? (
                              <button className={s.unblockBtn} onClick={() => unflagTask(task.id)}>
                                <Unlock size={10} />
                                Снять блок
                              </button>
                            ) : !task.isBlocked ? (
                              <button
                                className={s.blockBtn}
                                onClick={() => setBlockModal({ taskId: task.id, productName: task.productName, reason: '' })}
                              >
                                <Lock size={10} />
                                {mode === 'worker' ? 'Нужна помощь' : 'Заблокировать'}
                              </button>
                            ) : null}
                          </div>
                        )}

                        {task.status !== 'done' && (
                          <div className={s.defectRow}>
                            {defectInputs[task.id] !== undefined ? (
                              <>
                                <input
                                  className={s.defectInput}
                                  placeholder="Описание дефекта..."
                                  value={defectInputs[task.id]}
                                  onChange={(event) => setDefectInputs((prev) => ({ ...prev, [task.id]: event.target.value }))}
                                  autoFocus
                                />
                                <button className={s.defectSave} onClick={() => handleDefectSave(task.id)} aria-label="Сохранить дефект">
                                  <Check size={12} />
                                </button>
                                <button
                                  className={s.defectCancel}
                                  onClick={() => setDefectInputs((prev) => {
                                    const next = { ...prev };
                                    delete next[task.id];
                                    return next;
                                  })}
                                  aria-label="Отменить редактирование дефекта"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <button
                                className={s.defectToggle}
                                onClick={() => setDefectInputs((prev) => ({ ...prev, [task.id]: task.defects ?? '' }))}
                              >
                                {task.defects ? 'Изменить дефект' : 'Добавить дефект'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {blockModal && (
        <div className={s.modalOverlay} onClick={() => setBlockModal(null)}>
          <div className={s.blockModalBox} onClick={(event) => event.stopPropagation()}>
            <div className={s.blockModalTitle}>
              <Lock size={14} />
              Заблокировать: {blockModal.productName}
            </div>
            <input
              className={s.blockReasonInput}
              placeholder="Причина блокировки"
              value={blockModal.reason}
              onChange={(event) => setBlockModal((prev) => (prev ? { ...prev, reason: event.target.value } : null))}
              autoFocus
              onKeyDown={(event) => event.key === 'Enter' && handleBlockConfirm()}
            />
            <div className={s.blockModalActions}>
              <button className={s.blockModalCancel} onClick={() => setBlockModal(null)}>
                Отмена
              </button>
              <button
                className={s.blockModalConfirm}
                disabled={!blockModal.reason.trim()}
                onClick={handleBlockConfirm}
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
