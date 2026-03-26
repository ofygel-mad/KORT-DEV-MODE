import { create } from 'zustand';

interface ChapanUiState {
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
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
  };
});
