import { type BugSplatAttachment } from '@bugsplat/expo';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { PickedFile } from './attachments.types';

/**
 * Native attachment helpers. The web build uses `attachments.web.ts`.
 *
 * bugsplat-js posts attachments through `expo/fetch`, whose multipart encoder
 * (`expo/src/winter/fetch/convertFormData.ts`) reads each part's bytes from
 * `bytes()`, its filename from `name`, and its content type from `type`. A
 * `{ uri }` file ref isn't accepted at all ("Unsupported FormDataPart
 * implementation"); a `Blob` is accepted but, lacking a `name`, is encoded
 * *without* a `filename=` — so BugSplat receives it as a plain field and drops
 * it. A plain object carrying `name` + `type` + `bytes()` satisfies the
 * encoder fully, and bugsplat-js's `appendAttachment` forwards it untouched
 * (it only special-cases `Uint8Array` and `{ uri }` refs).
 */
function filePart(
  name: string,
  type: string,
  bytes: Uint8Array
): BugSplatAttachment['data'] {
  // Not a Blob/Uint8Array/BugSplatFileRef, but it is exactly the shape
  // expo/fetch's FormData encoder consumes — cast past the published type.
  return { name, type, bytes: async () => bytes } as unknown as BugSplatAttachment['data'];
}

/** Open the native document picker. Resolves to `null` if the user cancels. */
export async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  // Read the freshly-picked file now, while its cache copy is guaranteed present.
  const bytes = await new File(asset.uri).bytes();
  return {
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType,
    attachment: {
      filename: asset.name,
      data: filePart(asset.name, asset.mimeType ?? 'application/octet-stream', bytes),
    },
  };
}

/** Build a BugSplat attachment from in-memory log text. */
export function buildLogAttachment(filename: string, text: string): BugSplatAttachment {
  return { filename, data: filePart(filename, 'text/plain', new TextEncoder().encode(text)) };
}
