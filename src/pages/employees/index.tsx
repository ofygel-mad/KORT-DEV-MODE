import { useState } from 'react';
import { Plus, UserX, Key, Edit2, X } from 'lucide-react';
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDismissEmployee, useResetPassword } from '../../entities/employee/queries';
import type { Employee, CreateEmployeeDto, UpdateEmployeeDto, EmployeePermission } from '../../entities/employee/types';
import { PERMISSION_LABEL } from '../../entities/employee/types';
import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './Employees.module.css';

const ALL_PERMS: EmployeePermission[] = ['full_access', 'financial_report', 'sales', 'production', 'observer'];
const DEPT_PRESETS = ['Менеджмент', 'Продажи', 'Производство', 'Склад', 'Финансы', 'IT'];

// ── Add Employee Drawer ────────────────────────────────────────────────────────

function AddEmployeeDrawer({ onClose }: { onClose: () => void }) {
  const createEmployee = useCreateEmployee();
  const [form, setForm] = useState<CreateEmployeeDto>({
    phone: '', full_name: '', department: '', permissions: ['sales'],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function togglePerm(p: EmployeePermission) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.full_name.trim()) errs.full_name = 'Введите имя';
    if (!form.phone.trim()) errs.phone = 'Введите телефон';
    if (!/^\+7\d{10}$/.test(form.phone.trim())) errs.phone = 'Формат: +7XXXXXXXXXX';
    if (!form.department.trim()) errs.department = 'Введите отдел';
    if (!form.permissions.length) errs.permissions = 'Выберите хотя бы одно право';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    await createEmployee.mutateAsync(form);
    onClose();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Добавить сотрудника</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Имя <span className={styles.req}>*</span></label>
            <input className={`${styles.input} ${errors.full_name ? styles.inputErr : ''}`}
              value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Аманова Айгерим" autoFocus />
            {errors.full_name && <span className={styles.errMsg}>{errors.full_name}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Телефон <span className={styles.req}>*</span></label>
            <input className={`${styles.input} ${errors.phone ? styles.inputErr : ''}`}
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+77001234567" type="tel" />
            {errors.phone && <span className={styles.errMsg}>{errors.phone}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Отдел <span className={styles.req}>*</span></label>
            <input className={`${styles.input} ${errors.department ? styles.inputErr : ''}`} list="dept-list"
              value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              placeholder="Продажи" />
            <datalist id="dept-list">{DEPT_PRESETS.map(d => <option key={d} value={d} />)}</datalist>
            {errors.department && <span className={styles.errMsg}>{errors.department}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Права доступа <span className={styles.req}>*</span></label>
            <div className={styles.permGrid}>
              {ALL_PERMS.map(p => (
                <button key={p} type="button"
                  className={`${styles.permBtn} ${form.permissions.includes(p) ? styles.permBtnActive : ''}`}
                  onClick={() => togglePerm(p)}
                >{PERMISSION_LABEL[p]}</button>
              ))}
            </div>
            {errors.permissions && <span className={styles.errMsg}>{errors.permissions}</span>}
          </div>
          <div className={styles.drawerNote}>
            Система создаст учётную запись. Временный пароль будет показан после создания.
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={createEmployee.isPending}>
              {createEmployee.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Drawer ────────────────────────────────────────────────────────────────

function EditEmployeeDrawer({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const updateEmployee = useUpdateEmployee();
  const [form, setForm] = useState<UpdateEmployeeDto>({
    department: employee.department,
    permissions: [...employee.permissions],
  });

  function togglePerm(p: EmployeePermission) {
    setForm(f => ({
      ...f,
      permissions: (f.permissions ?? []).includes(p)
        ? (f.permissions ?? []).filter(x => x !== p)
        : [...(f.permissions ?? []), p],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await updateEmployee.mutateAsync({ id: employee.id, dto: form });
    onClose();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>{employee.full_name}</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Отдел</label>
            <input className={styles.input} list="dept-list2"
              value={form.department ?? ''} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            <datalist id="dept-list2">{DEPT_PRESETS.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Права доступа</label>
            <div className={styles.permGrid}>
              {ALL_PERMS.map(p => (
                <button key={p} type="button"
                  className={`${styles.permBtn} ${(form.permissions ?? []).includes(p) ? styles.permBtnActive : ''}`}
                  onClick={() => togglePerm(p)}
                >{PERMISSION_LABEL[p]}</button>
              ))}
            </div>
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={updateEmployee.isPending}>Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { data, isLoading, isError } = useEmployees();
  const dismissEmployee = useDismissEmployee();
  const resetPassword = useResetPassword();
  const [addOpen, setAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  const employees = data?.results ?? [];
  const active = employees.filter(e => e.status === 'active');
  const dismissed = employees.filter(e => e.status === 'dismissed');

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Сотрудники</h1>
        <div className={styles.headerRight}>
          <button className={styles.addBtn} onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Добавить
          </button>
        </div>
      </div>

      {isLoading && (
        <div className={styles.skeletons}>{[...Array(5)].map((_,i) => <Skeleton key={i} height={60} radius={8} />)}</div>
      )}
      {isError && <div className={styles.error}>Не удалось загрузить сотрудников</div>}

      {!isLoading && !isError && (
        <>
          <div className={styles.tableWrap}>
            {active.length > 0 && (
              <table className={styles.table}>
                <thead>
                  <tr><th>Сотрудник</th><th>Телефон</th><th>Отдел</th><th>Права</th><th>Добавлен</th><th></th></tr>
                </thead>
                <tbody>
                  {active.map(emp => (
                    <tr key={emp.id} className={styles.row}>
                      <td>
                        <div className={styles.empName}>{emp.full_name}</div>
                      </td>
                      <td className={styles.tdMono}>{emp.phone ?? '—'}</td>
                      <td className={styles.tdSecondary}>{emp.department}</td>
                      <td>
                        <div className={styles.permTags}>
                          {emp.permissions.map(p => (
                            <span key={p} className={styles.permTag}>{PERMISSION_LABEL[p]}</span>
                          ))}
                        </div>
                      </td>
                      <td className={styles.tdDate}>
                        {new Date(emp.joinedAt).toLocaleDateString('ru-KZ')}
                      </td>
                      <td className={styles.tdActions}>
                        <button className={styles.iconBtn} title="Редактировать" onClick={() => setEditEmployee(emp)}>
                          <Edit2 size={13} />
                        </button>
                        <button className={styles.iconBtn} title="Сбросить пароль" onClick={() => resetPassword.mutate(emp.id)}>
                          <Key size={13} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Деактивировать"
                          onClick={() => { if (confirm(`Деактивировать ${emp.full_name}?`)) dismissEmployee.mutate(emp.id); }}>
                          <UserX size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {active.length === 0 && (
              <div className={styles.empty}>
                <p>Сотрудников пока нет</p>
                <button className={styles.emptyBtn} onClick={() => setAddOpen(true)}>Добавить первого сотрудника</button>
              </div>
            )}

            {dismissed.length > 0 && (
              <>
                <div className={styles.sectionLabel}>Деактивированные</div>
                <table className={styles.table}>
                  <tbody>
                    {dismissed.map(emp => (
                      <tr key={emp.id} className={`${styles.row} ${styles.rowDismissed}`}>
                        <td><div className={styles.empName}>{emp.full_name}</div></td>
                        <td className={styles.tdMono}>{emp.phone ?? '—'}</td>
                        <td className={styles.tdSecondary}>{emp.department}</td>
                        <td colSpan={3}><span className={styles.dismissedBadge}>Деактивирован</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}

      {addOpen && <AddEmployeeDrawer onClose={() => setAddOpen(false)} />}
      {editEmployee && <EditEmployeeDrawer employee={editEmployee} onClose={() => setEditEmployee(null)} />}
    </div>
  );
}
