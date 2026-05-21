import type { PickedFile } from './pick-file.types';

/**
 * Open the browser's file picker. expo-document-picker's web shim opens the
 * dialog by dispatching a synthetic `MouseEvent('click')`, which Safari (and
 * some other browsers) refuse to honor for file inputs. Calling `input.click()`
 * directly — synchronously, from the user-gesture call stack — is honored
 * everywhere. Resolves to `null` when the user cancels.
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
              // Web: a File is a Blob subclass, which BugSplat accepts directly.
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
