import type { InviteContext, Membership, MembershipRole, Org, OrgSummary, User } from '../stores/auth';

// ─── Employee permissions ────────────────────────────────────────────────────
/** Права доступа сотрудника, назначаемые администратором через чекбоксы */
export type EmployeePermission =
  | 'full_access'         // Полный доступ — эквивалент прав руководителя
  | 'financial_report'    // Финансовый отчёт — Excel-импорт/экспорт, аналитика
  | 'sales'               // Продажи — лиды, сделки, заявки, сводки
  | 'production'          // Производство — раздел производства
  | 'warehouse_manager'   // Завсклад — приёмка, хранение, отгрузка
  | 'observer';           // Наблюдатель — просмотр без права редактирования

export type EmployeeAccountStatus = 'active' | 'pending_first_login' | 'dismissed';

export interface EmployeeRecord {
  id: string;
  full_name: string;
  phone: string;               // нормализованный +7XXXXXXXXXX
  department: string;
  permissions: EmployeePermission[];
  account_status: EmployeeAccountStatus;
  added_by_id: string;
  added_by_name: string;       // имя администратора, добавившего сотрудника
  created_at: string;          // ISO timestamp
}

export interface CreateEmployeePayload {
  phone: string;               // нормализованный +7XXXXXXXXXX
  full_name: string;
  department: string;
  permissions: EmployeePermission[];
}

export interface UpdateEmployeePayload {
  department?: string;
  permissions?: EmployeePermission[];
}

// ─── First-login flow ────────────────────────────────────────────────────────
/**
 * Бэкенд возвращает этот ответ вместо полной сессии, когда сотрудник
 * авторизуется через phone+phone (первый вход без пароля).
 * Фронтенд обязан перенаправить пользователя на SetPasswordStep.
 */
export interface FirstLoginResponse {
  requires_password_setup: true;
  temp_token: string;          // короткоживущий токен для /auth/set-password/
  user: {
    id: string;
    full_name: string;
    phone: string;
  };
}

/** Объединённый тип ответа на POST /auth/login/ */
export type LoginApiResponse = AuthSessionResponse | FirstLoginResponse;

/** Type guard для определения first-login ответа */
export function isFirstLoginResponse(value: LoginApiResponse | null): value is FirstLoginResponse {
  return Boolean(value && (value as FirstLoginResponse).requires_password_setup === true);
}

// ─── Auth session ────────────────────────────────────────────────────────────
export interface AuthSessionResponse {
  access: string;
  refresh: string;
  user: User;
  org: Org | null;
  capabilities: string[];
  role: MembershipRole | 'viewer';
  membership: Membership;
  onboarding_completed?: boolean;
  orgs?: OrgSummary[];
}

export interface CompanyDirectoryItem extends Org {
  industry?: string;
}

export interface TeamMemberResponse {
  id: string;
  full_name: string;
  email: string;
  status: string;
  role?: MembershipRole | 'viewer';
}

export interface InviteRecord extends InviteContext {
  created_at: string;
  created_by: string;
  share_url: string;
  status: 'valid' | 'used' | 'expired';
}

export interface MembershipRequestRecord {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company_id: string;
  company_name: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_role: MembershipRole;
  created_at: string;
}

export interface MembershipRequestSubmissionResponse {
  request: MembershipRequestRecord;
  membership: Membership;
}
