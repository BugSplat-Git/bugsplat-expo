import { type BugSplatAttachment } from '@bugsplat/expo';
import { Blob } from 'expo-blob';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { PickedFile } from './attachments.types';

/**
 * Native attachment helpers. The web build uses `attachments.web.ts`.
 *
 * Why everything becomes an expo-blob `Blob`: bugsplat-js posts attachments
 * through `expo/fetch`, whose multipart encoder (`convertFormDataAsync`) only
 * accepts a part that is a string, a `Blob`, or an object exposing `bytes()`.
 * A `{ uri }` file ref fails there ("Unsupported FormDataPart implementation")
 * and a raw `Uint8Array` is wrapped by bugsplat-js in a React Native `Blob`,
 * which can't be built from bytes. An expo-blob `Blob` satisfies the encoder
 * (it exposes `bytes()`) and bugsplat-js forwards it untouched.
 */

/** Open the native document picker. Resolves to `null` if the user cancels. */
export async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  // Read the picked file's bytes and re-wrap them in a Blob (see above).
  const bytes = await new File(asset.uri).bytes();
  return {
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType,
    attachment: {
      filename: asset.name,
      // expo-blob's Blob implements the Blob interface but its typed-array
      // generics differ slightly from lib.dom's — cast past the cosmetic gap.
      data: new Blob([bytes], asset.mimeType ? { type: asset.mimeType } : undefined) as BugSplatAttachment['data'],
    },
  };
}

/** Build a BugSplat attachment from in-memory log text. */
export function buildLogAttachment(filename: string, text: string): BugSplatAttachment {
  return {
    filename,
    data: new Blob([text], { type: 'text/plain' }) as BugSplatAttachment['data'],
  };
}
