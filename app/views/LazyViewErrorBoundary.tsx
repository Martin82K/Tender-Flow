import React from "react";
import { logIncident } from "@/services/incidentLogger";
import { APP_LAZY_MODULE_LOAD_ERROR_CODE } from "@/shared/errors/appLoadError";
import { AppLoadErrorView } from "@app/views/AppLoadErrorView";

interface LazyViewErrorBoundaryProps {
  children: React.ReactNode;
  onReload: () => void;
  onLogout: () => void;
}

interface LazyViewErrorBoundaryState {
  error: Error | null;
}

export class LazyViewErrorBoundary extends React.Component<
  LazyViewErrorBoundaryProps,
  LazyViewErrorBoundaryState
> {
  declare props: LazyViewErrorBoundaryProps;

  state: LazyViewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): LazyViewErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    void logIncident({
      severity: "error",
      source: "renderer",
      category: "runtime",
      code: APP_LAZY_MODULE_LOAD_ERROR_CODE,
      message: error.message || "Lazy view failed to render",
      stack: error.stack ?? info.componentStack ?? null,
      context: {
        operation: "lazy_view_render",
      },
    });
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <AppLoadErrorView
          error="Část aplikace se nepodařilo načíst. Obnovte stránku a zkuste akci znovu."
          errorCode={APP_LAZY_MODULE_LOAD_ERROR_CODE}
          onReload={this.props.onReload}
          onLogout={this.props.onLogout}
        />
      );
    }

    return this.props.children;
  }
}
