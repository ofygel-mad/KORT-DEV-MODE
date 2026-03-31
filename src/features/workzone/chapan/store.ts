import { create } from 'zustand';

interface ChapanUiState {
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  invoicesDrawerOpen: boolean;
  invoicesDrawerFilter: string;
  setInvoicesDrawerOpen: (open: boolean) => void;
  openInvoicesDrawer: (filter?: string) => void;
}

export const useChapanUiStore = create<ChapanUiState>((set) => {
  return {
    // selectedOrderId is transient UI navigation state — not durable business data.
    // Persisting it caused an infinite redirect loop: the list page would always
    // re-open the last viewed order instead of showing the list on back-navigate.
    selectedOrderId: null,
    setSelectedOrderId: (id) => set({ selectedOrderId: id }),
    invoicesDrawerOpen: false,
    invoicesDrawerFilter: 'all',
    setInvoicesDrawerOpen: (open) => set({ invoicesDrawerOpen: open }),
    openInvoicesDrawer: (filter = 'all') => set({ invoicesDrawerOpen: true, invoicesDrawerFilter: filter }),
  };
});
