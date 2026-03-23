import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { warehouseApi } from './api';
import type { CreateItemDto, AddMovementDto } from './types';

export const warehouseKeys = {
  all: ['warehouse'] as const,
  items: (params?: object) => ['warehouse', 'items', params] as const,
  movements: (params?: object) => ['warehouse', 'movements', params] as const,
  alerts: ['warehouse', 'alerts'] as const,
  categories: ['warehouse', 'categories'] as const,
  summary: ['warehouse', 'summary'] as const,
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

export const useResolveAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseApi.resolveAlert(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.alerts }); },
  });
};
