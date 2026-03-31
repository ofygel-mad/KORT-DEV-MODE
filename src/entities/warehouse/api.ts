import { api, apiClient } from '../../shared/api/client';
import type {
  WarehouseItem, WarehouseMovement, WarehouseAlert, WarehouseCategory,
  WarehouseSummary, PaginatedWarehouseItems, PaginatedMovements,
  CreateItemDto, AddMovementDto, ProductsAvailabilityMap,
  WarehouseFieldDefinition, WarehouseProductCatalog, OrderFormCatalog,
  VariantAvailability, ImportResult,
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

// ── Smart Catalog API ──────────────────────────────────────────────────────────

export const warehouseCatalogApi = {
  // Field definitions
  listDefinitions: () =>
    api.get<WarehouseFieldDefinition[]>('/warehouse/catalog/definitions'),

  createDefinition: (data: {
    code: string; label: string; inputType: string;
    isVariantAxis?: boolean; affectsAvailability?: boolean;
    showInWarehouseForm?: boolean; showInOrderForm?: boolean;
    sortOrder?: number;
  }) => api.post<WarehouseFieldDefinition>('/warehouse/catalog/definitions', data),

  updateDefinition: (id: string, data: Partial<WarehouseFieldDefinition>) =>
    api.patch<WarehouseFieldDefinition>(`/warehouse/catalog/definitions/${id}`, data),

  deleteDefinition: (id: string) =>
    api.delete<{ ok: boolean }>(`/warehouse/catalog/definitions/${id}`),

  addOption: (defId: string, data: { value: string; label: string; sortOrder?: number; colorHex?: string }) =>
    api.post(`/warehouse/catalog/definitions/${defId}/options`, data),

  bulkAddOptions: (defId: string, values: Array<{ value: string; label: string }>) =>
    api.post(`/warehouse/catalog/definitions/${defId}/options/bulk`, { values }),

  updateOption: (defId: string, optId: string, data: { label?: string; colorHex?: string }) =>
    api.patch(`/warehouse/catalog/definitions/${defId}/options/${optId}`, data),

  deleteOption: (defId: string, optId: string) =>
    api.delete(`/warehouse/catalog/definitions/${defId}/options/${optId}`),

  // Product catalog
  listProducts: () =>
    api.get<WarehouseProductCatalog[]>('/warehouse/catalog/products'),

  createProduct: (name: string) =>
    api.post<WarehouseProductCatalog>('/warehouse/catalog/products', { name }),

  updateProduct: (id: string, data: { name: string }) =>
    api.patch<WarehouseProductCatalog>(`/warehouse/catalog/products/${id}`, data),

  deleteProduct: (id: string) =>
    api.delete<{ ok: boolean }>(`/warehouse/catalog/products/${id}`),

  setProductFields: (productId: string, fields: Array<{ definitionId: string; isRequired?: boolean; sortOrder?: number }>) =>
    api.put<WarehouseProductCatalog>(`/warehouse/catalog/products/${productId}/fields`, { fields }),

  // Seed defaults (size, color, gender, length)
  seedDefaults: () =>
    api.post<{ created: string[]; skipped: string[] }>('/warehouse/catalog/seed-defaults', {}),

  // Order-form live catalog
  getOrderFormCatalog: () =>
    api.get<OrderFormCatalog>('/warehouse/order-form/catalog'),

  // Variant availability check
  checkVariant: (productName: string, attributes: Record<string, string>) =>
    api.post<VariantAvailability>('/warehouse/availability/check-variant', { productName, attributes }),

  // Smart one-click import (robot)
  smartImportProducts: (file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<{ fields: { created: string[]; skipped: string[] }; products: { created: number; skipped: number; errors: string[] } }>(
        '/warehouse/catalog/smart-import/products', form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data);
  },

  smartImportColors: (file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<{ field: string; created: number; skipped: number; errors: string[] }>(
        '/warehouse/catalog/smart-import/colors', form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data);
  },

  // Excel import
  importProducts: (file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<ImportResult>('/warehouse/catalog/import/products', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  importFieldOptions: (code: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<ImportResult>(`/warehouse/catalog/import/field-options/${code}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};
