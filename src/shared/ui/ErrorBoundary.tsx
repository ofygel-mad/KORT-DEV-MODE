import * as Sentry from '@sentry/react';
import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import styles from './ErrorBoundary.module.css';
import { redirectTo } from '../lib/browser';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[Kort ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className={styles.root}>
        <div className={styles.icon}><AlertTriangle size={28} /></div>
        <div className={styles.title}>
          Что-то пошло не так
        </div>
        <div className={styles.message}>
          {this.state.error?.message}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            this.setState({ hasError: false, error: undefined });
            redirectTo('/');
          }}
        >
          На главную
        </Button>
      </div>
    );
  }
}
