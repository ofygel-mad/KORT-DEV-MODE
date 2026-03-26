import ReactDOM from 'react-dom/client';
import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast, Toaster } from 'sonner';
import * as Sentry from '@sentry/react';
import { AppRouter } from './app/router';
import { ConsoleRoot } from './console';
import { Launch } from './pages/launch/Launch';
import { api } from './shared/api/client';
import type { AuthSessionResponse } from './shared/api/contracts';
import { readApiErrorMessage } from './shared/api/errors';
import { ensureDevAuthBypass } from './shared/config/devAccess';
import './shared/design/globals.css';
import { getNavigator, getWindow, isBrowser } from './shared/lib/browser';
import { useAuthStore } from './shared/stores/auth';
import { PageLoader } from './shared/ui/PageLoader';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: {
      onError: (error: unknown) => {
        toast.error(readApiErrorMessage(error, 'Произошла ошибка'));
      },
    },
  },
});

type BootstrapResponse = Omit<AuthSessionResponse, 'access' | 'refresh'> & { orgs?: import('./shared/stores/auth').OrgSummary[] };

const INTRO_KEY = 'kort.workspace:intro-v1';

function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

function shouldSkipIntro(): boolean {
  try {
    return window.location.pathname === '/workzone/request';
  } catch {
    return false;
  }
}

function SessionBootstrap({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const inviteContext = useAuthStore((state) => state.inviteContext);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const syncSession = useAuthStore((state) => state.syncSession);
  const [ready, setReady] = useState(() => !token);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    setReady(false);

    api.get<BootstrapResponse | null>('/auth/bootstrap/')
      .then((session) => {
        if (cancelled) {
          return;
        }

        if (!session) {
          clearAuth();
          return;
        }

        syncSession({
          user: session.user,
          org: session.org,
          capabilities: session.capabilities,
          role: session.role,
          membership: session.membership,
          inviteContext,
          orgs: session.orgs,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearAuth, inviteContext, syncSession, token]);

  if (!ready) {
    return <PageLoader />;
  }

  return <>{children}</>;
}

function App() {
  const skipIntro = shouldSkipIntro();
  const [introDone, setIntroDone] = useState(() => skipIntro || hasSeenIntro());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>
        <AppRouter />
      </SessionBootstrap>
      <Toaster position="bottom-right" richColors />
      <ConsoleRoot />

      {!skipIntro && !introDone && (
        <Launch
          introSessionKey={INTRO_KEY}
          onComplete={() => setIntroDone(true)}
        />
      )}
    </QueryClientProvider>
  );
}

ensureDevAuthBypass();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

const nav = getNavigator();
const win = getWindow();
if (isBrowser && nav && 'serviceWorker' in nav && import.meta.env.PROD && win) {
  const clearLegacyServiceWorkers = async () => {
    try {
      const registrations = await nav.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
      // ignore service worker cleanup failures
    }

    if ('caches' in win) {
      try {
        const cacheKeys = await win.caches.keys();
        await Promise.all(cacheKeys.map((cacheKey) => win.caches.delete(cacheKey)));
      } catch {
        // ignore cache cleanup failures
      }
    }
  };

  win.addEventListener('load', () => {
    void clearLegacyServiceWorkers();
  });
}
