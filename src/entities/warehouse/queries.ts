import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { warehouseApi, warehouseCatalogApi } from './api';
import type { CreateItemDto, AddMovementDto } from './types';

export const warehouseKeys = {
  all: ['warehouse'] as const,
  items: (params?: object) => ['warehouse', 'items', params] as const,
  movements: (params?: object) => ['warehouse', 'movements', params] as const,
  alerts: ['warehouse', 'alerts'] as const,
  categories: ['warehouse', 'categories'] as const,
  summary: ['warehouse', 'summary'] as const,
  catalog: {
    definitions: ['warehouse', 'catalog', 'definitions'] as const,
    products: ['warehouse', 'catalog', 'products'] as const,
    orderForm: ['warehouse', 'order-form', 'catalog'] as const,
  },
};

export const useWarehouseItems = (params?: { search?: string; categoryId?: string; lowStock?: string; page?: number }) =>
  useQuery({ queryKey: warehouseKeys.items(params), queryFn: () => warehouseApi.listItems(params) });

export const useWarehouseMovements = (params?: { itemId?: string; type?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: warehouseKeys.movements(params), queryFn: () => warehouseApi.listMovements(params) });

export const useWarehouseAlerts = () =>
  useQuery({ queryKey: warehouseKeys.alerts, queryFn: () => warehouseApi.listAlerts({ status: 'open' }) });

export const useWarehouseCategories = () =>
  useQuery({ queryKey: warehouseKeys.categories, queryFn: () => warehouseApi.listCategories() });

export const useWarehouseSummary = () =>
  useQuery({ queryKey: warehouseKeys.summary, queryFn: () => warehouseApi.getSummary() });

export const useCreateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateItemDto) => warehouseApi.createItem(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); toast.success('Позиция создана'); },
    onError: () => toast.error('Не удалось создать позицию'),
  });
};

export const useUpdateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateItemDto> }) => warehouseApi.updateItem(id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); toast.success('Сохранено'); },
    onError: () => toast.error('Не удалось сохранить'),
  });
};

export const useDeleteItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseApi.deleteItem(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); toast.success('Удалено'); },
    onError: () => toast.error('Не удалось удалить'),
  });
};

export const useAddMovement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddMovementDto) => warehouseApi.addMovement(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); toast.success('Движение записано'); },
    onError: () => toast.error('Ошибка при записи движения'),
  });
};

/** Check finished-goods availability for a list of product names (Chapan integration) */
export const useProductsAvailability = (names: string[]) => {
  const sorted = [...names].sort();
  return useQuery({
    queryKey: ['warehouse_products_availability', sorted],
    queryFn: () => warehouseApi.checkProducts(sorted),
    enabled: sorted.length > 0,
    staleTime: 30_000,
  });
};

export const useResolveAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseApi.resolveAlert(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.alerts }); },
  });
};

// ── Smart Catalog hooks ────────────────────────────────────────────────────────

export const useCatalogDefinitions = () =>
  useQuery({
    queryKey: warehouseKeys.catalog.definitions,
    queryFn: () => warehouseCatalogApi.listDefinitions(),
  });

export const useCatalogProducts = () =>
  useQuery({
    queryKey: warehouseKeys.catalog.products,
    queryFn: () => warehouseCatalogApi.listProducts(),
  });

export const useOrderFormCatalog = () =>
  useQuery({
    queryKey: warehouseKeys.catalog.orderForm,
    queryFn: () => warehouseCatalogApi.getOrderFormCatalog(),
    staleTime: 60_000,
  });

export const useCreateDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: warehouseCatalogApi.createDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      toast.success('Поле создано');
    },
    onError: () => toast.error('Не удалось создать поле'),
  });
};

export const useUpdateDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      warehouseCatalogApi.updateDefinition(id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось обновить поле'),
  });
};

export const useDeleteDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseCatalogApi.deleteDefinition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success('Поле удалено');
    },
    onError: () => toast.error('Не удалось удалить поле'),
  });
};

export const useAddFieldOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ defId, value, label }: { defId: string; value: string; label: string }) =>
      warehouseCatalogApi.addOption(defId, { value, label }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось добавить значение'),
  });
};

export const useUpdateFieldOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ defId, optId, data }: { defId: string; optId: string; data: { label?: string; colorHex?: string } }) =>
      warehouseCatalogApi.updateOption(defId, optId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось обновить значение'),
  });
};

export const useDeleteFieldOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ defId, optId }: { defId: string; optId: string }) =>
      warehouseCatalogApi.deleteOption(defId, optId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось удалить значение'),
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      warehouseCatalogApi.updateProduct(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось переименовать товар'),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseCatalogApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success('Товар удалён');
    },
    onError: () => toast.error('Не удалось удалить товар'),
  });
};

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => warehouseCatalogApi.createProduct(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success('Товар добавлен');
    },
    onError: () => toast.error('Не удалось добавить товар'),
  });
};

export const useSetProductFields = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, fields }: { productId: string; fields: Array<{ definitionId: string; isRequired?: boolean; sortOrder?: number }> }) =>
      warehouseCatalogApi.setProductFields(productId, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success('Поля товара сохранены');
    },
    onError: () => toast.error('Не удалось сохранить поля товара'),
  });
};

export const useSeedDefaults = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => warehouseCatalogApi.seedDefaults(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success(`Созданы поля: ${data.created.length > 0 ? data.created.join(', ') : 'нет новых'}`);
    },
    onError: () => toast.error('Не удалось инициализировать поля'),
  });
};

export const useSmartImportProducts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => warehouseCatalogApi.smartImportProducts(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      const { products, fields } = data;
      toast.success(`Загружено: ${products.created} товаров. Поля: ${fields.created.length > 0 ? fields.created.join(', ') : 'уже были'}`);
    },
    onError: () => toast.error('Ошибка загрузки таблицы товаров'),
  });
};

export const useSmartImportColors = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => warehouseCatalogApi.smartImportColors(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success(`Загружено: ${data.created} цветов`);
    },
    onError: () => toast.error('Ошибка загрузки таблицы цветов'),
  });
};

export const useImportProducts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => warehouseCatalogApi.importProducts(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success(`Товары импортированы: +${data.created}, пропущено ${data.skipped}`);
    },
    onError: () => toast.error('Ошибка импорта товаров'),
  });
};

export const useImportFieldOptions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, file }: { code: string; file: File }) =>
      warehouseCatalogApi.importFieldOptions(code, file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success(`Значения импортированы: +${data.created}, пропущено ${data.skipped}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Ошибка импорта'),
  });
};
