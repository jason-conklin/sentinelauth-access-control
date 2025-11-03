import React from "react";

type State = { hasError: boolean; info?: string; message?: string };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Unknown error" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    this.setState({ info: info?.componentStack, message: error?.message ?? this.state.message });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-sm text-text-ink">
          <div className="rounded-lg border border-yellow-300 bg-amber-50 p-4 shadow">
            <h2 className="mb-2 font-semibold">Something went wrong.</h2>
            <button
              className="mt-2 rounded-md border border-yellow-400 bg-yellow-200/60 px-3 py-1 transition hover:bg-yellow-200"
              onClick={() => location.reload()}
            >
              Reload
            </button>
            {this.state.message ? (
              <p className="mt-3 text-xs text-red-700">Error: {this.state.message}</p>
            ) : null}
            {this.state.info ? (
              <pre className="mt-3 whitespace-pre-wrap text-xs">{this.state.info}</pre>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
