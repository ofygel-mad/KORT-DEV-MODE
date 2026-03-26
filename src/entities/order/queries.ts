import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ordersApi, productionApi, chapanSettingsApi, invoicesApi } from './api';
import type { CreateOrderDto, UpdateOrderDto, AddPaymentDto, ChapanCatalogs, ChapanProfile } from './types';
import { readApiErrorMessage } from '../../shared/api/errors';

// ── Query keys ────────────────────────────────────────────────────────────────

export const orderKeys = {
  all: ['chapan_orders'] as const,
  list: (filters?: object) => [...orderKeys.all, filters] as const,
  detail: (id: string) => [...orderKeys.all, id] as const,
  production: ['chapan_production'] as const,
  productionList: (filters?: object) => [...orderKeys.production, filters] as const,
  invoices: ['chapan_invoices'] as const,
  invoiceList: (filters?: object) => ['chapan_invoices', filters] as const,
  invoiceDetail: (id: string) => ['chapan_invoices', id] as const,
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

export const useUpdateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateOrderDto }) => ordersApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Заказ обновлён');
    },
    onError: () => toast.error('Не удалось сохранить изменения'),
  });
};

export const useRestoreOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status?: string }) => ordersApi.restore(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Заказ восстановлен');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось восстановить заказ')),
  });
};

export const useArchiveOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.archive(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Заказ перемещён в архив');
    },
    onError: () => toast.error('Не удалось архивировать заказ'),
  });
};

export const useCloseOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.close(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.success('Сделка закрыта, заказ отправлен в архив');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось закрыть сделку')),
  });
};

export const useFulfillFromStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.fulfillFromStock(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Заказ выполнен со склада — готов к выдаче');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось выполнить со склада')),
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

export const useShipOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.ship(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Заказ отправлен клиенту');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось отправить заказ')),
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

export const useClaimProductionTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => productionApi.claim(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.production }),
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось взять заказ в работу')),
  });
};

export const useAssignWorker = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, worker }: { taskId: string; worker: string | null }) =>
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

// ── Invoices ──────────────────────────────────────────────────────────────────

export const useInvoices = (params?: Parameters<typeof invoicesApi.list>[0]) =>
  useQuery({
    queryKey: orderKeys.invoiceList(params),
    queryFn: () => invoicesApi.list(params),
  });

export const useInvoice = (id: string) =>
  useQuery({
    queryKey: orderKeys.invoiceDetail(id),
    queryFn: () => invoicesApi.get(id),
    enabled: Boolean(id),
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderIds, notes }: { orderIds: string[]; notes?: string }) =>
      invoicesApi.create(orderIds, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Накладная создана');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось создать накладную')),
  });
};

export const useConfirmSeamstress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.confirmSeamstress(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.invoiceDetail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Отправка подтверждена');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось подтвердить')),
  });
};

export const useConfirmWarehouse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.confirmWarehouse(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.invoiceDetail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Получение подтверждено');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось подтвердить')),
  });
};

export const useRejectInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoicesApi.reject(id, reason),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.invoiceDetail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Накладная отклонена');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось отклонить')),
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
