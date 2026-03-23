import type {
  BugSplatInitOptions,
  BugSplatPostOptions,
  BugSplatPostResult,
} from './BugsplatExpo.types';
import BugsplatExpoModule from './BugsplatExpoModule';

/**
 * Initialize BugSplat crash reporting.
 * On iOS: configures BugSplat.shared() and calls start().
 * On Android: calls BugSplatBridge.initBugSplat().
 */
export async function init(
  database: string,
  application: string,
  version: string,
  options?: BugSplatInitOptions
): Promise<void> {
  await BugsplatExpoModule.init(database, application, version, options as Record<string, unknown>);
}

/**
 * Manually post an error to BugSplat.
 * Sends the error to BugSplat's /post/js endpoint via HTTP from native code.
 */
export async function post(
  error: Error | string,
  options?: BugSplatPostOptions
): Promise<BugSplatPostResult> {
  const message = error instanceof Error ? error.message : error;
  const callstack = error instanceof Error ? (error.stack ?? message) : message;
  return BugsplatExpoModule.post(message, callstack, options as Record<string, unknown>);
}

/**
 * Set the default user info for subsequent crash reports.
 */
export function setUser(name: string, email: string): void {
  BugsplatExpoModule.setUser(name, email);
}

/**
 * Set a custom searchable attribute on subsequent crash reports.
 */
export function setAttribute(key: string, value: string): void {
  BugsplatExpoModule.setAttribute(key, value);
}

/**
 * Trigger a test crash. Useful for verifying BugSplat integration.
 */
export function crash(): void {
  BugsplatExpoModule.crash();
}
