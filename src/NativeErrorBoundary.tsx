import { Component, ErrorInfo, ReactNode } from "react";
import { post } from "./BugsplatExpo";

interface NativeErrorBoundaryProps {
  children?: ReactNode;
  fallback?:
    | ReactNode
    | ((props: { error: Error; resetError: () => void }) => ReactNode);
}

interface NativeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class NativeErrorBoundary extends Component<
  NativeErrorBoundaryProps,
  NativeErrorBoundaryState
> {
  state: NativeErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): NativeErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    post(error, {
      description: `Component stack: ${errorInfo.componentStack}`,
    }).catch((err) => console.warn("BugSplat post failed:", err));
  }

  resetError = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback({
          error: this.state.error!,
          resetError: this.resetError,
        });
      }
      return fallback ?? null;
    }
    return this.props.children;
  }
}
