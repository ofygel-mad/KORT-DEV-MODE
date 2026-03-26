import { api } from '../../shared/api/client';
import type {
  WarehouseItem, WarehouseMovement, WarehouseAlert, WarehouseCategory,
  WarehouseSummary, PaginatedWarehouseItems, PaginatedMovements,
  CreateItemDto, AddMovementDto, ProductsAvailabilityMap,
} from './types';

export const warehouseApi = {
  // Items
  listItems: (params?: { search?: string; categoryId?: string; lowStock?: string; page?: number }) =>
    api.get<PaginatedWarehouseItems>('/warehouse/items', params),

  createItem: (dto: CreateItemDto) =>
    api.post<WarehouseItem>('/warehouse/items', dto),

  updateItem: (id: string, dto: Partial<CreateItemDto>) =>
    api.patch<WarehouseItem>(`/warehouse/items/${id}`, dto),

  deleteItem: (id: string) =>
    api.delete<{ ok: boolean }>(`/warehouse/items/${id}`),

  // Movements
  listMovements: (params?: { itemId?: string; type?: string; page?: number; limit?: number }) =>
    api.get<PaginatedMovements>('/warehouse/movements', params),

  addMovement: (dto: AddMovementDto) =>
    api.post<WarehouseMovement>('/warehouse/movements', dto),

  // Alerts
  listAlerts: (params?: { status?: string }) =>
    api.get<{ count: number; results: WarehouseAlert[] }>('/warehouse/alerts', params),

  resolveAlert: (id: string) =>
    api.patch<WarehouseAlert>(`/warehouse/alerts/${id}/resolve`, {}),

  // Categories
  listCategories: () =>
    api.get<{ count: number; results: WarehouseCategory[] }>('/warehouse/categories'),

  createCategory: (name: string) =>
    api.post<WarehouseCategory>('/warehouse/categories', { name }),

  // Summary
  getSummary: () =>
    api.get<WarehouseSummary>('/warehouse/summary'),

  // Chapan integration: check if finished products are in stock by name
  checkProducts: (names: string[]) =>
    api.post<ProductsAvailabilityMap>('/warehouse/products-availability', { names }),
};
