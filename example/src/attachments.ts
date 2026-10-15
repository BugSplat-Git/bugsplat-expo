import { type BugSplatAttachment } from '@bugsplat/expo';
import * as DocumentPicker from 'expo-document-picker';
import type { PickedFile } from './attachments.types';

/**
 * Native attachment helpers. The web build uses `attachments.web.ts`.
 */

/** Open the native document picker. Resolves to `null` if the user cancels. */
export async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return {
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType,
    attachment: {
      filename: asset.name,
      data: { uri: asset.uri, type: asset.mimeType },
    },
  };
}

/** Build a BugSplat attachment from in-memory log text. */
export function buildLogAttachment(filename: string, text: string): BugSplatAttachment {
  return { filename, data: new TextEncoder().encode(text) };
}
