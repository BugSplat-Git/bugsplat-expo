export { NativeErrorBoundary as ErrorBoundary } from '../NativeErrorBoundary';

export function useErrorHandler() {
  throw new Error('useErrorHandler is only available on web');
}

export function withErrorBoundary() {
  throw new Error('withErrorBoundary is only available on web');
}
