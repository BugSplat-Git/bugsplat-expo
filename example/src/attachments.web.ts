import { type BugSplatAttachment } from '@bugsplat/expo';
import type { PickedFile } from './attachments.types';

/**
 * Web attachment helpers. The native build uses `attachments.ts`.
 *
 * In the browser, `fetch` / `FormData` / `Blob` are the platform's own, so a
 * picked `File` (a `Blob` subclass) and an in-memory `Blob` upload directly.
 */

/**
 * Open the browser's file picker. expo-document-picker's web shim opens the
 * dialog by dispatching a synthetic `MouseEvent('click')`, which Safari refuses
 * to honor for file inputs; calling `input.click()` directly — synchronously,
 * from the user-gesture call stack — is honored everywhere. Resolves to `null`
 * when the user cancels.
 */
export function pickFile(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (value: PickedFile | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      finish(
        file
          ? {
              name: file.name,
              size: file.size,
              mimeType: file.type || undefined,
              attachment: { filename: file.name, data: file },
            }
          : null
      );
    });
    // Fired by modern browsers when the dialog is dismissed without a choice.
    input.addEventListener('cancel', () => finish(null));

    input.click();
  });
}

/** Build a BugSplat attachment from in-memory log text. */
export function buildLogAttachment(filename: string, text: string): BugSplatAttachment {
  return { filename, data: new Blob([text], { type: 'text/plain' }) };
}
