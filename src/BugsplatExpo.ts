import 'expo-blob';
import { File as ExpoFile } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import {
  type BugSplat,
  init as initReact,
} from '@bugsplat/react';
import type {
  BugSplatAttachment,
  BugSplatFeedbackOptions,
  BugSplatFeedbackResult,
  BugSplatInitOptions,
  BugSplatPostOptions,
  BugSplatPostResult,
} from './BugsplatExpo.types';
import BugsplatExpoModule from './BugsplatExpoModule';

export const nativeAvailable = BugsplatExpoModule != null;

let jsClient: BugSplat | null = null;
const jsAttributes: Record<string, string> = {};

function applyDefaults(client: BugSplat, options?: BugSplatInitOptions): void {
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
}

type FormDataBytesPart = {
  name: string;
  type: string;
  bytes: () => Promise<Uint8Array>;
};

/**
 * Converts an attachment into the part shape expo/fetch's multipart encoder
 * reads: `bytes()` for the body, `name` for the `filename=` and `type` for the
 * part's content type. A global `Blob` is already encoded correctly and passes
 * through unchanged.
 */
function toExpoFetchAttachment(attachment: BugSplatAttachment): BugSplatAttachment {
  const { filename, data } = attachment;
  if (data instanceof Blob) {
    return attachment;
  }

  let part: FormDataBytesPart;
  if (data instanceof Uint8Array) {
    part = { name: filename, type: 'application/octet-stream', bytes: async () => data };
  } else if ('uri' in data) {
    part = {
      name: filename,
      type: data.type ?? 'application/octet-stream',
      bytes: () => new ExpoFile(data.uri).bytes(),
    };
  } else {
    const blobLike = data as { type?: string; bytes: () => Promise<Uint8Array> };
    part = {
      name: filename,
      type: blobLike.type || 'application/octet-stream',
      bytes: () => blobLike.bytes(),
    };
  }
  return { filename, data: part as unknown as BugSplatAttachment['data'] };
}

function withExpoFetchAttachments<T extends BugSplatPostOptions | undefined>(options: T): T {
  if (!options?.attachments) {
    return options;
  }
  return { ...options, attachments: options.attachments.map(toExpoFetchAttachment) };
}

/**
 * Initialize BugSplat crash reporting.
 * When native modules are available (dev client / production build), configures
 * the native SDK. When unavailable (e.g. Expo Go), falls back to JS-based
 * error reporting — JS errors are still captured and posted over HTTP.
 *
 * A JS client is always initialized so that HTTP-only APIs like
 * {@link postFeedback} work regardless of platform.
 */
export async function init(
  database: string,
  application: string,
  version: string,
  options?: BugSplatInitOptions
): Promise<void> {
  if (nativeAvailable) {
    await BugsplatExpoModule!.init(database, application, version, options as Record<string, unknown>);
    initReact({ database, application, version })((client) => {
      // @ts-expect-error -- accessing private _fetch to inject expo/fetch
      client._fetch = expoFetch;
      jsClient = client;
      applyDefaults(client, options);
    });
    return;
  }

  console.warn(
    '[@bugsplat/expo] Native crash reporting is unavailable (e.g. running in Expo Go). ' +
    'JS error reporting will use HTTP fallback. ' +
    'Use a development build to enable full native crash reporting.'
  );

  initReact({ database, application, version })((client) => {
    // @ts-expect-error -- accessing private _fetch to inject expo/fetch
    client._fetch = expoFetch;
    jsClient = client;
    applyDefaults(client, options);
  });
}

/**
 * Manually post an error to BugSplat.
 * Always uses the JS client's HTTP transport — the native bridge handles
 * native crashes (Crashpad / PLCrashReporter), not JS-caught errors.
 */
export async function post(
  error: Error | string,
  options?: BugSplatPostOptions
): Promise<BugSplatPostResult> {
  if (!jsClient) {
    return { success: false, error: 'BugSplat has not been initialized. Call init() first.' };
  }

  const err = error instanceof Error ? error : new Error(error);
  try {
    const result = await jsClient.post(err, withExpoFetchAttachments(options));
    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Submit user feedback to BugSplat.
 * Feedback is delivered over HTTP, so this works identically in native builds,
 * Expo Go, and on web.
 *
 * @param title Short summary of the feedback (required)
 * @param options Optional overrides for user, email, appKey, and description
 */
export async function postFeedback(
  title: string,
  options?: BugSplatFeedbackOptions
): Promise<BugSplatFeedbackResult> {
  if (!jsClient) {
    return { success: false, error: 'BugSplat has not been initialized. Call init() first.' };
  }

  try {
    const result = await jsClient.postFeedback(title, withExpoFetchAttachments(options));
    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true, crashId: result.response?.crash_id };
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

/**
 * Freeze the main UI thread in a native loop. On Android this produces a real
 * ANR with symbolicated native frames (~5s of unresponsive input fires the
 * detector). On iOS the main thread blocks indefinitely — when the Apple SDK's
 * hang tracker is enabled, a fatal-hang report is persisted; otherwise the user
 * can force-quit to capture the hang. Requires a development build — no-op in
 * Expo Go.
 */
export function hang(): void {
  if (nativeAvailable) {
    BugsplatExpoModule!.hang();
    return;
  }
  console.warn('[@bugsplat/expo] hang() requires native modules. Use a development build to test native hangs.');
}
