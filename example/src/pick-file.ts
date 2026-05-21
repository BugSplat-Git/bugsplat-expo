import { type BugSplatAttachment } from '@bugsplat/expo';
import * as DocumentPicker from 'expo-document-picker';
import type { PickedFile } from './pick-file.types';

/**
 * Open the native document picker (iOS / Android). Resolves to `null` when the
 * user cancels. The web build uses `pick-file.web.ts` instead.
 */
export async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return {
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType,
    // Native: hand BugSplat a file reference; bugsplat-js reads it from the uri.
    attachment: {
      filename: asset.name,
      data: { uri: asset.uri, type: asset.mimeType } as BugSplatAttachment['data'],
    },
  };
}
