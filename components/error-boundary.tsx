"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-danger/20 bg-danger/10">
              <AlertTriangle className="h-6 w-6 text-danger" />
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">
                {this.props.fallbackTitle ?? "Something went wrong"}
              </h3>
              <p className="text-sm leading-6 text-white/60">
                An unexpected error occurred in this component. This has been logged for review.
              </p>
              {this.state.error && (
                <pre className="mt-2 max-h-32 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/40 font-mono">
                  {this.state.error.message}
                </pre>
              )}
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
