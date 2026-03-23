// Native stubs — these are web-only features from @bugsplat/react.
// They are not available on iOS or Android.

export const ErrorBoundary = null;

export function useErrorHandler() {
  throw new Error('useErrorHandler is only available on web');
}

export function withErrorBoundary() {
  throw new Error('withErrorBoundary is only available on web');
}
