// Re-export React-specific tools from @bugsplat/react for web users.
// This file is only resolved on web — native platforms use index.native.ts.
export {
  ErrorBoundary,
  useErrorHandler,
  withErrorBoundary,
} from '@bugsplat/react';
