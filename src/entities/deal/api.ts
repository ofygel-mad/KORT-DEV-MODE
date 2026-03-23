import { api } from '../../shared/api/client';
import type { Deal, DealBoard, PaginatedDeals, CreateDealDto, UpdateDealDto, AddDealActivityDto, DealActivity } from './types';

export const dealsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedDeals>('/deals', params),

  // Use this for Kanban — returns deals grouped by stage
  getBoard: () =>
    api.get<DealBoard>('/deals/board/'),

  get: (id: string) =>
    api.get<Deal>(`/deals/${id}`),

  getActivities: (id: string) =>
    api.get<{ results: DealActivity[] }>(`/deals/${id}/activities`),

  create: (dto: CreateDealDto) =>
    api.post<Deal>('/deals', dto),

  update: (id: string, dto: UpdateDealDto) =>
    api.patch<Deal>(`/deals/${id}`, dto),

  addActivity: (id: string, dto: AddDealActivityDto) =>
    api.post<DealActivity>(`/deals/${id}/activities`, dto),

  delete: (id: string) =>
    api.delete<{ ok: boolean }>(`/deals/${id}`),
};
