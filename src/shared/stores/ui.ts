import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCommandPalette } from './commandPalette';
import { getDocument, getWindow, readStorage } from '../lib/browser';

export type Theme = 'dark' | 'light' | 'system';
export type ThemePack = 'neutral' | 'graphite' | 'sand' | 'obsidian' | 'enterprise';

type ActionRequest<T = undefined> = {
  nonce: number;
  payload: T;
};

type CreateDealPayload = {
  customerId?: string;
  title?: string;
};

type CreateTaskPayload = {
  customerId?: string;
  title?: string;
};

interface UIStore {
  theme: Theme;
  themePack: ThemePack;
  sidebarCollapsed: boolean;
  focusMode: boolean;
  workspaceAddMenuOpen: boolean;
  createCustomerRequest: ActionRequest<undefined>;
  createDealRequest: ActionRequest<CreateDealPayload | undefined>;
  createTaskRequest: ActionRequest<CreateTaskPayload | undefined>;
  assistantPromptRequest: ActionRequest<string | undefined>;
  setTheme: (t: Theme) => void;
  setThemePack: (pack: ThemePack) => void;
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  openWorkspaceAddMenu: () => void;
  closeWorkspaceAddMenu: () => void;
  openCreateCustomer: () => void;
  openCreateDeal: (payload?: CreateDealPayload) => void;
  openCreateTask: (payload?: CreateTaskPayload) => void;
  openAssistantPrompt: (prompt?: string) => void;
  openCommandPalette: () => void;
}

let _systemMQCleanup: (() => void) | null = null;

function resolveSystemTheme(): 'dark' | 'light' {
  return getWindow()?.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme, pack: ThemePack = 'neutral', animate = true) {
  const root = getDocument()?.documentElement;
  if (!root) return;

  if (animate) {
    root.classList.add('theme-transitioning');
    setTimeout(() => root.classList.remove('theme-transitioning'), 220);
  }

  // Remove previous system-theme listener if any
  if (_systemMQCleanup) {
    _systemMQCleanup();
    _systemMQCleanup = null;
  }

  let resolved: 'dark' | 'light';
  if (theme === 'system') {
    resolved = resolveSystemTheme();
    // Keep in sync with OS preference
    const mq = getWindow()?.matchMedia('(prefers-color-scheme: dark)');
    if (mq) {
      const handler = (e: MediaQueryListEvent) => {
        const r = e.matches ? 'dark' : 'light';
        root.setAttribute('data-theme', r);
        root.setAttribute('data-theme-mode', r);
        root.style.colorScheme = r;
      };
      mq.addEventListener('change', handler);
      _systemMQCleanup = () => mq.removeEventListener('change', handler);
    }
  } else {
    resolved = theme;
  }

  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', resolved);
  root.setAttribute('data-theme-pack', pack);
  root.style.colorScheme = resolved;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      themePack: 'neutral',
      sidebarCollapsed: false,
      focusMode: false,
      workspaceAddMenuOpen: false,
      createCustomerRequest: { nonce: 0, payload: undefined },
      createDealRequest: { nonce: 0, payload: undefined },
      createTaskRequest: { nonce: 0, payload: undefined },
      assistantPromptRequest: { nonce: 0, payload: undefined },
      setTheme: (t) => {
        set({ theme: t });
        applyTheme(t, get().themePack);
      },
      setThemePack: (themePack) => {
        set({ themePack });
        applyTheme(get().theme, themePack);
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      openWorkspaceAddMenu: () => set({ workspaceAddMenuOpen: true }),
      closeWorkspaceAddMenu: () => set({ workspaceAddMenuOpen: false }),
      openCreateCustomer: () => set((s) => ({
        createCustomerRequest: { nonce: s.createCustomerRequest.nonce + 1, payload: undefined },
      })),
      openCreateDeal: (payload) => set((s) => ({
        createDealRequest: { nonce: s.createDealRequest.nonce + 1, payload },
      })),
      openCreateTask: (payload) => set((s) => ({
        createTaskRequest: { nonce: s.createTaskRequest.nonce + 1, payload },
      })),
      openAssistantPrompt: (prompt) => set((s) => ({
        assistantPromptRequest: { nonce: s.assistantPromptRequest.nonce + 1, payload: prompt },
      })),
      openCommandPalette: () => useCommandPalette.getState().open(),
    }),
    {
      name: 'kort-ui',
      partialize: (state) => ({
        theme: state.theme,
        themePack: state.themePack,
        sidebarCollapsed: state.sidebarCollapsed,
        focusMode: state.focusMode,
      }),
    },
  ),
);

const win = getWindow();
if (win) {
  const raw = readStorage('kort-ui');
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? JSON.parse(raw).state ?? {} : {};
  } catch {
    parsed = {};
  }
  const stored = parsed.theme as string | undefined;
  const theme: Theme = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'dark';
  const themePack: ThemePack = (parsed.themePack as ThemePack) ?? 'neutral';
  applyTheme(theme, themePack, false);
}
