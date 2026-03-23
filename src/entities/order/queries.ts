import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ordersApi, productionApi, chapanSettingsApi } from './api';
import type { CreateOrderDto, AddPaymentDto, ChapanCatalogs, ChapanProfile } from './types';

// ── Query keys ────────────────────────────────────────────────────────────────

export const orderKeys = {
  all: ['chapan_orders'] as const,
  list: (filters?: object) => [...orderKeys.all, filters] as const,
  detail: (id: string) => [...orderKeys.all, id] as const,
  production: ['chapan_production'] as const,
  productionList: (filters?: object) => [...orderKeys.production, filters] as const,
  settings: ['chapan_settings'] as const,
  catalogs: ['chapan_catalogs'] as const,
  clients: ['chapan_clients'] as const,
};

// ── Orders ────────────────────────────────────────────────────────────────────

export const useOrders = (params?: Parameters<typeof ordersApi.list>[0]) =>
  useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => ordersApi.list(params),
  });

export const useOrder = (id: string) =>
  useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.get(id),
    enabled: Boolean(id),
  });

export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateOrderDto) => ordersApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Заказ создан');
    },
    onError: () => toast.error('Не удалось создать заказ'),
  });
};

export const useConfirmOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.confirm(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.success('Заказ подтверждён и отправлен в цех');
    },
    onError: () => toast.error('Не удалось подтвердить заказ'),
  });
};

export const useChangeOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      ordersApi.changeStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
    },
    onError: () => toast.error('Не удалось изменить статус'),
  });
};

export const useAddPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AddPaymentDto }) =>
      ordersApi.addPayment(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Оплата добавлена');
    },
    onError: () => toast.error('Не удалось добавить оплату'),
  });
};

export const useAddOrderActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      ordersApi.addActivity(id, content),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
    },
  });
};

// ── Production ────────────────────────────────────────────────────────────────

export const useProductionTasks = (params?: Parameters<typeof productionApi.list>[0]) =>
  useQuery({
    queryKey: orderKeys.productionList(params),
    queryFn: () => productionApi.list(params),
  });

export const useWorkshopTasks = () =>
  useQuery({
    queryKey: [...orderKeys.production, 'workshop'],
    queryFn: () => productionApi.listWorkshop(),
  });

export const useUpdateProductionStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      productionApi.updateStatus(taskId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.production }),
    onError: () => toast.error('Не удалось изменить статус задания'),
  });
};

export const useAssignWorker = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, worker }: { taskId: string; worker: string }) =>
      productionApi.assignWorker(taskId, worker),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.production }),
  });
};

export const useFlagTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
      productionApi.flag(taskId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.warning('Задание заблокировано');
    },
  });
};

export const useUnflagTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => productionApi.unflag(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.success('Блокировка снята');
    },
  });
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const useChapanCatalogs = () =>
  useQuery({
    queryKey: orderKeys.catalogs,
    queryFn: () => chapanSettingsApi.getCatalogs(),
  });

export const useChapanProfile = () =>
  useQuery({
    queryKey: orderKeys.settings,
    queryFn: () => chapanSettingsApi.getProfile(),
  });

export const useSaveCatalogs = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ChapanCatalogs>) => chapanSettingsApi.saveCatalogs(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.catalogs });
      toast.success('Каталог сохранён');
    },
    onError: () => toast.error('Не удалось сохранить'),
  });
};

export const useSaveProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ChapanProfile>) => chapanSettingsApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.settings });
      toast.success('Профиль сохранён');
    },
  });
};

export const useChapanClients = () =>
  useQuery({
    queryKey: orderKeys.clients,
    queryFn: () => chapanSettingsApi.getClients(),
  });
