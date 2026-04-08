import type { BugSplat } from 'bugsplat';
import { init as initReact } from '@bugsplat/react';

import type {
  BugSplatInitOptions,
  BugSplatPostOptions,
  BugSplatPostResult,
} from './BugsplatExpo.types';
import BugsplatExpoModule from './BugsplatExpoModule';

export const nativeAvailable = BugsplatExpoModule != null;

let jsClient: BugSplat | null = null;
const jsAttributes: Record<string, string> = {};

/**
 * Initialize BugSplat crash reporting.
 * When native modules are available (dev client / production build), configures
 * the native SDK. When unavailable (e.g. Expo Go), falls back to JS-based
 * error reporting — JS errors are still captured and posted over HTTP.
 */
export async function init(
  database: string,
  application: string,
  version: string,
  options?: BugSplatInitOptions
): Promise<void> {
  if (nativeAvailable) {
    await BugsplatExpoModule!.init(database, application, version, options as Record<string, unknown>);
    return;
  }

  console.warn(
    '[@bugsplat/expo] Native crash reporting is unavailable (e.g. running in Expo Go). ' +
    'JS error reporting will use HTTP fallback. ' +
    'Use a development build to enable full native crash reporting.'
  );

  initReact({ database, application, version })((client) => {
    jsClient = client;
    if (options?.appKey) client.setDefaultAppKey(options.appKey);
    if (options?.userName) client.setDefaultUser(options.userName);
    if (options?.userEmail) client.setDefaultEmail(options.userEmail);
    if (options?.description) client.setDefaultDescription(options.description);
    if (options?.attributes) {
      Object.assign(jsAttributes, options.attributes);
    }
    if (Object.keys(jsAttributes).length > 0) {
      client.setDefaultAttributes(jsAttributes);
    }
  });
}

/**
 * Manually post an error to BugSplat.
 * Uses native code when available, otherwise falls back to JS HTTP transport.
 */
export async function post(
  error: Error | string,
  options?: BugSplatPostOptions
): Promise<BugSplatPostResult> {
  if (nativeAvailable) {
    const message = error instanceof Error ? error.message : error;
    const callstack = error instanceof Error ? (error.stack ?? message) : message;
    return BugsplatExpoModule!.post(message, callstack, options as Record<string, unknown>);
  }

  if (!jsClient) {
    return { success: false, error: 'BugSplat has not been initialized. Call init() first.' };
  }

  const err = error instanceof Error ? error : new Error(error);
  try {
    const result = await jsClient.post(err, {
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
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Set the default user info for subsequent crash reports.
 */
export function setUser(name: string, email: string): void {
  if (nativeAvailable) {
    BugsplatExpoModule!.setUser(name, email);
    return;
  }
  if (jsClient) {
    jsClient.setDefaultUser(name);
    jsClient.setDefaultEmail(email);
  }
}

/**
 * Set a custom searchable attribute on subsequent crash reports.
 */
export function setAttribute(key: string, value: string): void {
  if (nativeAvailable) {
    BugsplatExpoModule!.setAttribute(key, value);
    return;
  }
  jsAttributes[key] = value;
  if (jsClient) {
    jsClient.setDefaultAttributes(jsAttributes);
  }
}

/**
 * Remove a custom attribute so it is no longer included in crash reports.
 */
export function removeAttribute(key: string): void {
  if (nativeAvailable) {
    BugsplatExpoModule!.removeAttribute(key);
    return;
  }
  delete jsAttributes[key];
  if (jsClient) {
    jsClient.setDefaultAttributes(jsAttributes);
  }
}

/**
 * Trigger a test crash. Useful for verifying BugSplat integration.
 * Requires a development build with native modules — no-op in Expo Go.
 */
export function crash(): void {
  if (nativeAvailable) {
    BugsplatExpoModule!.crash();
    return;
  }
  console.warn('[@bugsplat/expo] crash() requires native modules. Use a development build to test native crashes.');
}
