import { api } from '../../shared/api/client';
import type {
  ChapanOrder, CreateOrderDto, AddPaymentDto, ListResponse,
  ProductionTask, ChapanCatalogs, ChapanProfile, ChapanClient,
} from './types';

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersApi = {
  list: (params?: {
    status?: string;
    priority?: string;
    paymentStatus?: string;
    search?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<ListResponse<ChapanOrder>>('/chapan/orders', params),

  get: (id: string) =>
    api.get<ChapanOrder>(`/chapan/orders/${id}`),

  create: (dto: CreateOrderDto) =>
    api.post<ChapanOrder>('/chapan/orders', dto),

  confirm: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/confirm`, {}),

  changeStatus: (id: string, status: string) =>
    api.patch<{ ok: boolean }>(`/chapan/orders/${id}/status`, { status }),

  addPayment: (id: string, dto: AddPaymentDto) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/payments`, dto),

  addActivity: (id: string, content: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/activities`, {
      type: 'comment',
      content,
    }),
};

// ── Production ────────────────────────────────────────────────────────────────

export const productionApi = {
  // Manager view — includes clientName/clientPhone
  list: (params?: { status?: string; assignedTo?: string }) =>
    api.get<ListResponse<ProductionTask>>('/chapan/production', params),

  // Workshop view — no PII
  listWorkshop: () =>
    api.get<ListResponse<ProductionTask>>('/chapan/production/workshop'),

  // Move to next status
  // Backend enum: 'pending' | 'cutting' | 'sewing' | 'finishing' | 'quality_check' | 'done'
  updateStatus: (taskId: string, status: string) =>
    api.patch<{ ok: boolean }>(`/chapan/production/${taskId}/status`, { status }),

  // Assign worker — backend expects { worker }, NOT { workerName }
  assignWorker: (taskId: string, worker: string) =>
    api.patch<{ ok: boolean }>(`/chapan/production/${taskId}/assign`, { worker }),

  flag: (taskId: string, reason: string) =>
    api.post<{ ok: boolean }>(`/chapan/production/${taskId}/flag`, { reason }),

  unflag: (taskId: string) =>
    api.post<{ ok: boolean }>(`/chapan/production/${taskId}/unflag`, {}),

  setDefect: (taskId: string, defect: string) =>
    api.patch<{ ok: boolean }>(`/chapan/production/${taskId}/defect`, { defect }),
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const chapanSettingsApi = {
  getProfile: () =>
    api.get<ChapanProfile>('/chapan/settings/profile'),

  updateProfile: (data: Partial<ChapanProfile>) =>
    api.patch<ChapanProfile>('/chapan/settings/profile', data),

  // Returns { productCatalog: string[], fabricCatalog: string[], sizeCatalog: string[], workers: string[] }
  getCatalogs: () =>
    api.get<ChapanCatalogs>('/chapan/settings/catalogs'),

  // Full replace — send entire new arrays
  saveCatalogs: (data: Partial<ChapanCatalogs>) =>
    api.put<{ ok: boolean }>('/chapan/settings/catalogs', data),

  getClients: () =>
    api.get<ListResponse<ChapanClient>>('/chapan/settings/clients'),

  createClient: (data: { fullName: string; phone: string; email?: string; company?: string; notes?: string }) =>
    api.post<ChapanClient>('/chapan/settings/clients', data),
};
