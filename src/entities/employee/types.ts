// Backend: /api/v1/company/employees
// Note: prefix is /api/v1/company NOT /api/v1/employees

export type EmployeePermission = 'full_access' | 'financial_report' | 'sales' | 'production' | 'observer';

export interface Employee {
  id: string;                   // userId
  full_name: string;
  phone: string | null;
  department: string;
  permissions: EmployeePermission[];
  status: 'active' | 'dismissed';
  addedByName: string | null;
  joinedAt: string;
}

export const PERMISSION_LABEL: Record<EmployeePermission, string> = {
  full_access: 'Полный доступ',
  financial_report: 'Финансы',
  sales: 'Продажи',
  production: 'Производство',
  observer: 'Наблюдатель',
};

export interface CreateEmployeeDto {
  phone: string;       // +7XXXXXXXXXX format
  full_name: string;
  department: string;
  permissions: EmployeePermission[];
}

export interface UpdateEmployeeDto {
  department?: string;
  permissions?: EmployeePermission[];
}
