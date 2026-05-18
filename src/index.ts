export type {
  BugSplatAttachment,
  BugSplatOptions,
  BugSplatInitOptions,
  BugSplatPostOptions,
  BugSplatPostResult,
  BugSplatFeedbackOptions,
  BugSplatFeedbackResult,
  BugSplatPluginOptions,
} from './BugsplatExpo.types';

export {
  init,
  post,
  postFeedback,
  setUser,
  setAttribute,
  removeAttribute,
  crash,
  hang,
  nativeAvailable,
} from './BugsplatExpo';

export {
  ErrorBoundary,
  useErrorHandler,
  useFeedback,
  withErrorBoundary,
} from '@bugsplat/react';

export type {
  FallbackProps,
  FallbackElement,
  FallbackRender,
} from '@bugsplat/react';
