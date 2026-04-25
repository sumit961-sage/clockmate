import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
          <div className="size-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="size-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Something went wrong</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={this.handleRetry} className="mt-4" variant="outline">
            <RefreshCw className="size-4 mr-2" /> Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
