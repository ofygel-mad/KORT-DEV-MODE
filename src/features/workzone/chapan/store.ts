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
  // Load initial state from sessionStorage
  const saved = typeof window !== 'undefined' ? sessionStorage.getItem('chapan_selected_order') : null;

  return {
    selectedOrderId: saved,
    setSelectedOrderId: (id) => {
      if (id) {
        sessionStorage.setItem('chapan_selected_order', id);
      } else {
        sessionStorage.removeItem('chapan_selected_order');
      }
      set({ selectedOrderId: id });
    },
    invoicesDrawerOpen: false,
    invoicesDrawerFilter: 'all',
    setInvoicesDrawerOpen: (open) => set({ invoicesDrawerOpen: open }),
    openInvoicesDrawer: (filter = 'all') => set({ invoicesDrawerOpen: true, invoicesDrawerFilter: filter }),
  };
});
