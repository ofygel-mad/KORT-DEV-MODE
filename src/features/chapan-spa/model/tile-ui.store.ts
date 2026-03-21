/**
 * features/chapan-spa/model/tile-ui.store.ts
 * Per-tile UI state for the Chapan SPA.
 * Cached per tileId so multiple instances stay independent.
 */
import { createStore, useStore } from 'zustand';
import type { StoreApi } from 'zustand';
import type { OrderStatus, OrderPriority, PaymentStatus, OrderSortBy, ViewMode } from '../api/types';

export type ChapanSection = 'requests' | 'orders' | 'production' | 'settings';

export interface CreateOrderPrefill {
  sourceRequestId?: string;
  clientName?: string;
  clientPhone?: string;
  dueDate?: string;
  priority?: OrderPriority;
  items: Array<{
    productName?: string;
    fabric?: string;
    size?: string;
    quantity?: number;
    workshopNotes?: string;
  }>;
}

export interface TileChapanUIState {
  section: ChapanSection;
  viewMode: ViewMode;
  sortBy: OrderSortBy;

  // Filters
  filterStatus: OrderStatus | 'all';
  filterPriority: OrderPriority | 'all';
  filterPayment: PaymentStatus | 'all';
  searchQuery: string;

  // Drawer
  activeOrderId: string | null;
  drawerOpen: boolean;

  // Modals
  createModalOpen: boolean;
  createPrefill: CreateOrderPrefill | null;

  // Cancel reason modal
  cancelModalOpen: boolean;
  cancelOrderId: string | null;

  // Actions
  setSection: (s: ChapanSection) => void;
  setViewMode: (m: ViewMode) => void;
  setSortBy: (s: OrderSortBy) => void;
  setFilterStatus: (s: OrderStatus | 'all') => void;
  setFilterPriority: (p: OrderPriority | 'all') => void;
  setFilterPayment: (p: PaymentStatus | 'all') => void;
  setSearchQuery: (q: string) => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  openCreateModal: () => void;
  openCreateModalWithPrefill: (prefill: CreateOrderPrefill) => void;
  closeCreateModal: () => void;
  clearCreatePrefill: () => void;
  openCancelModal: (orderId: string) => void;
  closeCancelModal: () => void;
}

const cache = new Map<string, StoreApi<TileChapanUIState>>();

function createTileChapanUI(): StoreApi<TileChapanUIState> {
  return createStore<TileChapanUIState>()((set) => ({
    section: 'orders',
    viewMode: 'list',
    sortBy: 'createdAt',

    filterStatus: 'all',
    filterPriority: 'all',
    filterPayment: 'all',
    searchQuery: '',

    activeOrderId: null,
    drawerOpen: false,

    createModalOpen: false,
    createPrefill: null,

    cancelModalOpen: false,
    cancelOrderId: null,

    setSection: (section) => set({ section }),
    setViewMode: (viewMode) => set({ viewMode }),
    setSortBy: (sortBy) => set({ sortBy }),
    setFilterStatus: (filterStatus) => set({ filterStatus }),
    setFilterPriority: (filterPriority) => set({ filterPriority }),
    setFilterPayment: (filterPayment) => set({ filterPayment }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    openDrawer: (id) => set({ activeOrderId: id, drawerOpen: true }),
    closeDrawer: () => set({ drawerOpen: false, activeOrderId: null }),
    openCreateModal: () => set({ createModalOpen: true, createPrefill: null }),
    openCreateModalWithPrefill: (createPrefill) => set({ createModalOpen: true, createPrefill }),
    closeCreateModal: () => set({ createModalOpen: false, createPrefill: null }),
    clearCreatePrefill: () => set({ createPrefill: null }),
    openCancelModal: (orderId) => set({ cancelModalOpen: true, cancelOrderId: orderId }),
    closeCancelModal: () => set({ cancelModalOpen: false, cancelOrderId: null }),
  }));
}

function getTileChapanUI(tileId: string): StoreApi<TileChapanUIState> {
  if (!cache.has(tileId)) cache.set(tileId, createTileChapanUI());
  return cache.get(tileId)!;
}

export function useTileChapanUI(tileId: string): TileChapanUIState {
  return useStore(getTileChapanUI(tileId));
}

export function clearTileChapanUI(tileId: string): void {
  cache.delete(tileId);
}
