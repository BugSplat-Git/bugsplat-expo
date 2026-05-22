import type { BugSplatAttachment } from '@bugsplat/expo';

/**
 * A file chosen by the user, normalized across the native and web pickers
 * (`attachments.ts` / `attachments.web.ts`). Shared so `FeedbackSheet` doesn't
 * care which platform produced it.
 */
export interface PickedFile {
  /** Original file name, e.g. "signup-bug.png". */
  name: string;
  /** Size in bytes, when the platform reports it. */
  size?: number;
  /** MIME type, when known — used as a fallback for the type chip label. */
  mimeType?: string;
  /** Ready-to-send BugSplat attachment for this file. */
  attachment: BugSplatAttachment;
}
