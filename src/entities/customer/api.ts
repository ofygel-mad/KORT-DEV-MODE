import { api } from '../../shared/api/client';
import type { Customer } from './types';
interface PaginatedCustomers { count: number; page: number; limit: number; totalPages: number; results: Customer[]; }
export const customersApi = {
  list: (params?: { page?: number; limit?: number; q?: string }) =>
    api.get<PaginatedCustomers>('/customers', params),
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (dto: { fullName: string; phone?: string; email?: string; companyName?: string; city?: string; source?: string; notes?: string }) =>
    api.post<Customer>('/customers', dto),
  update: (id: string, dto: Partial<{ fullName: string; phone: string; email: string; companyName: string; city: string; notes: string }>) =>
    api.patch<Customer>(`/customers/${id}`, dto),
};
