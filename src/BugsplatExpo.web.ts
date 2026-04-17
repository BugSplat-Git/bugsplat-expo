import type { BugSplat } from '@bugsplat/react';
import { init as initReact } from '@bugsplat/react';

import type {
  BugSplatFeedbackOptions,
  BugSplatFeedbackResult,
  BugSplatInitOptions,
  BugSplatPostOptions,
  BugSplatPostResult,
} from './BugsplatExpo.types';

let instance: BugSplat | null = null;

function getInstance(): BugSplat {
  if (!instance) {
    throw new Error(
      'BugSplat has not been initialized. Call init() first.'
    );
  }
  return instance;
}

/**
 * Initialize BugSplat crash reporting for web.
 * Creates a BugSplat instance and wires up global error handlers.
 */
export async function init(
  database: string,
  application: string,
  version: string,
  options?: BugSplatInitOptions
): Promise<void> {
  initReact({ database, application, version })((client) => {
    instance = client;

    if (options?.appKey) {
      client.setDefaultAppKey(options.appKey);
    }
    if (options?.userName) {
      client.setDefaultUser(options.userName);
    }
    if (options?.userEmail) {
      client.setDefaultEmail(options.userEmail);
    }
    if (options?.description) {
      client.setDefaultDescription(options.description);
    }
  });
}

/**
 * Manually post an error to BugSplat.
 */
export async function post(
  error: Error | string,
  options?: BugSplatPostOptions
): Promise<BugSplatPostResult> {
  const bs = getInstance();
  const err = error instanceof Error ? error : new Error(error);

  try {
    const result = await bs.post(err, {
      appKey: options?.appKey,
      user: options?.user,
      email: options?.email,
      description: options?.description,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Submit user feedback to BugSplat.
 *
 * @param title Short summary of the feedback (required)
 * @param options Optional overrides for user, email, appKey, and description
 */
export async function postFeedback(
  title: string,
  options?: BugSplatFeedbackOptions
): Promise<BugSplatFeedbackResult> {
  const bs = getInstance();
  try {
    const result = await bs.postFeedback(title, {
      appKey: options?.appKey,
      user: options?.user,
      email: options?.email,
      description: options?.description,
    });
    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true, crashId: result.response?.crash_id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Set the default user info for subsequent error reports.
 */
export function setUser(name: string, email: string): void {
  const bs = getInstance();
  bs.setDefaultUser(name);
  bs.setDefaultEmail(email);
}

/**
 * Set a custom attribute. Note: bugsplat-js does not natively support
 * custom attributes, so this is a no-op on web with a console warning.
 */
export function setAttribute(key: string, _value: string): void {
  console.warn(
    `[@bugsplat/expo] setAttribute('${key}') is not supported on web.`
  );
}

/**
 * Remove a custom attribute. No-op on web.
 */
export function removeAttribute(key: string): void {
  console.warn(
    `[@bugsplat/expo] removeAttribute('${key}') is not supported on web.`
  );
}

/**
 * Trigger a test crash by throwing an unhandled error.
 */
export function crash(): void {
  throw new Error('BugSplat test crash');
}
