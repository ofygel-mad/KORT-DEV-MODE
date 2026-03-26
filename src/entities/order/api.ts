import { api } from '../../shared/api/client';
import type {
  ChapanOrder, ChapanInvoice, CreateOrderDto, UpdateOrderDto, AddPaymentDto, ListResponse,
  ProductionTask, ChapanCatalogs, ChapanProfile, ChapanClient,
} from './types';

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersApi = {
  list: (params?: {
    status?: string;
    statuses?: string;
    priority?: string;
    paymentStatus?: string;
    search?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
    archived?: boolean;
  }) =>
    api.get<ListResponse<ChapanOrder>>('/chapan/orders', params),

  get: (id: string) =>
    api.get<ChapanOrder>(`/chapan/orders/${id}`),

  create: (dto: CreateOrderDto) =>
    api.post<ChapanOrder>('/chapan/orders', dto),

  update: (id: string, dto: UpdateOrderDto) =>
    api.patch<ChapanOrder>(`/chapan/orders/${id}`, dto),

  restore: (id: string, status?: string) =>
    status === 'cancelled'
      ? api.patch<{ ok: boolean }>(`/chapan/orders/${id}/status`, { status: 'new' })
      : api.post<{ ok: boolean }>(`/chapan/orders/${id}/restore`, {}),

  archive: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/archive`, {}),

  close: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/close`, {}),

  confirm: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/confirm`, {}),

  changeStatus: (id: string, status: string) =>
    api.patch<{ ok: boolean }>(`/chapan/orders/${id}/status`, { status }),

  addPayment: (id: string, dto: AddPaymentDto) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/payments`, {
      amount: dto.amount,
      method: dto.method,
      notes: dto.note,
    }),

  ship: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/ship`, {}),

  fulfillFromStock: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/fulfill-from-stock`, {}),

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

  claim: (taskId: string) =>
    api.post<{ ok: boolean }>(`/chapan/production/${taskId}/claim`, {}),

  updateStatus: (taskId: string, status: string) =>
    api.patch<{ ok: boolean }>(`/chapan/production/${taskId}/status`, { status }),

  assignWorker: (taskId: string, worker: string | null) =>
    api.patch<{ ok: boolean }>(`/chapan/production/${taskId}/assign`, { worker }),

  flag: (taskId: string, reason: string) =>
    api.post<{ ok: boolean }>(`/chapan/production/${taskId}/flag`, { reason }),

  unflag: (taskId: string) =>
    api.post<{ ok: boolean }>(`/chapan/production/${taskId}/unflag`, {}),

  setDefect: (taskId: string, defect: string) =>
    api.patch<{ ok: boolean }>(`/chapan/production/${taskId}/defect`, { defect }),
};

// ── Invoices (Накладные) ──────────────────────────────────────────────────────

export const invoicesApi = {
  create: (orderIds: string[], notes?: string) =>
    api.post<ChapanInvoice>('/chapan/invoices', { orderIds, notes }),

  list: (params?: { status?: string; limit?: number }) =>
    api.get<ListResponse<ChapanInvoice>>('/chapan/invoices', params),

  get: (id: string) =>
    api.get<ChapanInvoice>(`/chapan/invoices/${id}`),

  confirmSeamstress: (id: string) =>
    api.post<{ bothConfirmed: boolean }>(`/chapan/invoices/${id}/confirm-seamstress`, {}),

  confirmWarehouse: (id: string) =>
    api.post<{ bothConfirmed: boolean }>(`/chapan/invoices/${id}/confirm-warehouse`, {}),

  reject: (id: string, reason: string) =>
    api.post<{ ok: boolean }>(`/chapan/invoices/${id}/reject`, { reason }),
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
